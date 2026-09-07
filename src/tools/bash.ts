import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { JSONSchemaType } from 'ajv'
import {
  formatSize,
  DEFAULT_MAX_BYTES as MAX_BYTES,
  DEFAULT_MAX_LINES as MAX_LINES,
  type TruncationResult,
  truncateTail,
} from './truncate.ts'
import { useTool } from './use-tool.ts'

// ================================================================
// Limits (mirroring pi's bash tool + read tool conventions)
// ================================================================

/** Spawn timeouts are int32 milliseconds — cap seconds accordingly. */
const MAX_TIMEOUT_SECONDS = 2_147_483 // ≈ int32 ms / 1000

/**
 * Resolve the interpreter once. bash is preferred (models emit bash-flavored
 * syntax); sh is the last-resort fallback — its `-c` bridge semantics are
 * identical. MINIMAL: no custom-shellPath config; upgrade path is a settings
 * override like pi's shellPath.
 */
const shell = Bun.which('bash') ?? Bun.which('sh') ?? 'bash'

/**
 * Strip control characters (keeping \t \n \r) and interlinear-annotation
 * ranges so binary garbage never reaches the model context.
 */
const sanitize = (text: string): string =>
  Array.from(text)
    .filter((char) => {
      const code = char.codePointAt(0)
      if (code === undefined) return false
      if (code === 0x09 || code === 0x0a || code === 0x0d) return true
      if (code <= 0x1f) return false
      if (code >= 0xfff9 && code <= 0xfffb) return false
      return true
    })
    .join('')

/**
 * Tail-truncate to the last MAX_LINES lines / MAX_BYTES bytes (whichever
 * bites first) via the shared truncateTail — UTF-8-safe, never splits a
 * multibyte character. Tail-biased: errors surface at the end of output.
 *
 * MINIMAL: streaming OutputAccumulator bounded memory + process-tree kill
 * + stdout/stderr interleaving deferred to the kernel phase. Upgrade path:
 * pi's OutputAccumulator + killProcessTree.
 */

type Input = {
  command: string
  cwd: string
  env?: Record<string, string>
  timeout?: number
}

export const BashInputSchema: JSONSchemaType<Input> = {
  type: 'object',
  properties: {
    command: { type: 'string', minLength: 1, description: 'bash command to execute' },
    cwd: { type: 'string', description: "the tool's provisioned cwd" },
    env: {
      type: 'object',
      nullable: true,
      required: [],
      additionalProperties: { type: 'string' },
      description: 'extra environment variables to set for the command',
    },
    timeout: {
      type: 'integer',
      nullable: true,
      minimum: 1,
      maximum: MAX_TIMEOUT_SECONDS,
      description: `timeout in seconds (optional, no default; max ${MAX_TIMEOUT_SECONDS})`,
    },
  },
  required: ['command', 'cwd'],
  additionalProperties: false,
}

type Output = {
  stdout: string
  stderr: string
  exitCode: number
  truncated?: boolean
  fullOutputPath?: string
  notice?: string
}

export const BashOutputSchema: JSONSchemaType<Output> = {
  type: 'object',
  properties: {
    stdout: { type: 'string' },
    stderr: { type: 'string' },
    exitCode: { type: 'integer' },
    truncated: {
      type: 'boolean',
      nullable: true,
      description: 'true when output exceeded the tail-truncation limits (last 2000 lines / 50KB)',
    },
    fullOutputPath: {
      type: 'string',
      nullable: true,
      description: 'absolute path to the untruncated output — present only when truncated',
    },
    notice: {
      type: 'string',
      nullable: true,
      description: 'continuation hint when output was truncated — names the spill path and line range',
    },
  },
  required: ['stdout', 'stderr', 'exitCode'],
  additionalProperties: false,
}

/**
 * Execute a shell command via `Bun.spawn` with an optional native timeout.
 *
 * The input is shell *source code* — pipes, `&&`, redirection, expansion —
 * so it runs through an interpreter (`shell -c`): `Bun.spawn` takes argv,
 * not program text. Non-zero exit codes are returned as data — never thrown.
 *
 * Bun-native timeout kills the process with SIGTERM; a killed run is
 * reported with exitCode -1 and a `timed out` marker in stderr.
 *
 * `cwd` is a required input field — always provided by the provisioner, never
 * model-chosen.
 *
 * **Full-output spill**: when truncation fires, the complete output is
 * written to a temp file under an mkdtemp'd `$TMPDIR` directory and its
 * path is reported as `fullOutputPath` — the model's next `read` retrieves
 * what the tail dropped. No spill on the happy path.
 *
 * MINIMAL: spill files accumulate until OS tmp cleanup (no explicit deletion
 * — matches pi); no sandbox/policy run-composition hook (Phase 5/7 — policy
 * packs wrap `run`); Windows requires bash (Git Bash) on PATH.
 */

export const BASH_NAME = 'bash'
export const bash = useTool(
  {
    name: BASH_NAME,
    description:
      'Execute a bash command in the current working directory. Returns stdout, stderr, and exit code. ' +
      `Output is tail-truncated to the last ${MAX_LINES} lines or ${MAX_BYTES / 1024}KB (whichever is hit first). ` +
      `Optional timeout in seconds (max ${MAX_TIMEOUT_SECONDS}); a timed-out command reports exitCode -1.`,
    inputSchema: BashInputSchema,
    outputSchema: BashOutputSchema,
  },
  async ({ command, timeout, cwd, env: extraEnv }, _validate) => {
    try {
      const spillDir = await mkdtemp(join(tmpdir(), 'bash-spill-'))

      const proc = Bun.spawn([shell, '-c', command], {
        cwd,
        env: extraEnv ? { ...process.env, ...extraEnv } : undefined,
        stdin: 'ignore',
        stdout: 'pipe',
        stderr: 'pipe',
        ...(timeout === undefined ? {} : { timeout: timeout * 1000 }),
      })

      const [rawStdout, rawStderr] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      const exitCode = await proc.exited

      type Captured = {
        content: string
        truncation: TruncationResult
        fullOutputPath: string | undefined
        sanitized: string
      }

      /** Tail-truncate via the shared truncateTail; spill the full raw output on truncation. */
      const capture = async (raw: string, spillName: string): Promise<Captured> => {
        const sanitized = sanitize(raw)
        const truncation = truncateTail(sanitized)
        if (!truncation.truncated) {
          return { content: truncation.content, truncation, fullOutputPath: undefined, sanitized }
        }
        const spillPath = join(spillDir, spillName)
        await Bun.write(spillPath, raw)
        return { content: truncation.content, truncation, fullOutputPath: spillPath, sanitized }
      }

      /** Build a continuation notice naming the spill path and line range. */
      const buildNotice = (stream: 'stdout' | 'stderr', cap: Captured): string | undefined => {
        if (!cap.fullOutputPath) return undefined
        const { truncation, fullOutputPath, sanitized } = cap
        const startLine = truncation.totalLines - truncation.outputLines + 1
        const endLine = truncation.totalLines
        if (truncation.lastLinePartial) {
          const lines = sanitized.split('\n')
          const lastLineBytes = Buffer.byteLength(lines[lines.length - 1] ?? '', 'utf-8')
          return `[${stream}: Showing last ${formatSize(truncation.outputBytes)} of line ${endLine} (line is ${formatSize(lastLineBytes)}). Full output: ${fullOutputPath}]`
        }
        if (truncation.truncatedBy === 'lines') {
          return `[${stream}: Showing lines ${startLine}-${endLine} of ${truncation.totalLines}. Full output: ${fullOutputPath}]`
        }
        return `[${stream}: Showing lines ${startLine}-${endLine} of ${truncation.totalLines} (${formatSize(MAX_BYTES)} limit). Full output: ${fullOutputPath}]`
      }

      /** Combine per-stream notices into a single notice string. */
      const combineNotices = (parts: (string | undefined)[]): string | undefined => {
        const filtered = parts.filter((p): p is string => p !== undefined)
        return filtered.length > 0 ? filtered.join('\n') : undefined
      }

      // Native timeout kills with SIGTERM — surface it as the timeout condition
      if (timeout !== undefined && proc.signalCode !== null) {
        const out = await capture(rawStdout, 'stdout.log')
        const err = await capture(rawStderr, 'stderr.log')
        return {
          stdout: out.content,
          stderr: `${err.content}\nCommand timed out after ${timeout} seconds (${proc.signalCode})`.trim(),
          exitCode: -1,
          truncated: out.truncation.truncated || err.truncation.truncated || undefined,
          fullOutputPath: out.fullOutputPath ?? err.fullOutputPath,
          notice: combineNotices([buildNotice('stdout', out), buildNotice('stderr', err)]),
        }
      }

      const stdoutCap = await capture(rawStdout, 'stdout.log')
      const stderrCap = await capture(rawStderr, 'stderr.log')
      return {
        stdout: stdoutCap.content,
        stderr: stderrCap.content,
        exitCode: exitCode ?? -1,
        truncated: stdoutCap.truncation.truncated || stderrCap.truncation.truncated || undefined,
        fullOutputPath: stdoutCap.fullOutputPath ?? stderrCap.fullOutputPath,
        notice: combineNotices([buildNotice('stdout', stdoutCap), buildNotice('stderr', stderrCap)]),
      }
    } catch (err) {
      // Catch unexpected spawn errors (command not found, cwd deleted, etc.)
      return {
        stdout: '',
        stderr: `[Error executing command: ${(err as Error).message}]`,
        exitCode: -1,
      }
    }
  },
)
