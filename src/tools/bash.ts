import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { CwdProvision, JsonObject, ToolArgs } from './pack.types.ts'

// ================================================================
// Limits (mirroring pi's bash tool + read tool conventions)
// ================================================================

/** Spawn timeouts are int32 milliseconds — cap seconds accordingly. */
const MAX_TIMEOUT_SECONDS = 2_147_483 // ≈ int32 ms / 1000
const MAX_LINES = 2000
const MAX_BYTES = 50 * 1024

export const inputSchema = {
  type: 'object',
  properties: {
    command: { type: 'string', minLength: 1, description: 'bash command to execute' },
    timeout: {
      type: 'integer',
      minimum: 1,
      maximum: MAX_TIMEOUT_SECONDS,
      description: `timeout in seconds (optional, no default; max ${MAX_TIMEOUT_SECONDS} — spawn timeouts are int32 milliseconds)`,
    },
  },
  required: ['command'],
  additionalProperties: false,
}

export const outputSchema = {
  type: 'object',
  properties: {
    stdout: { type: 'string' },
    stderr: { type: 'string' },
    exitCode: { type: 'integer' },
    truncated: {
      type: 'boolean',
      description: 'true when output exceeded the tail-truncation limits (last 2000 lines / 50KB)',
    },
    fullOutputPath: {
      type: 'string',
      description: 'absolute path to the untruncated output — present only when truncated',
    },
  },
  required: ['stdout', 'stderr', 'exitCode'],
  additionalProperties: false,
}

type BashInput = {
  command: string
  timeout?: number
  /** Provision-time only — never model-facing. */
  cwd?: string
  /** Extra env vars layered over the inherited environment (provision-time). */
  env?: Record<string, string>
}
export type BashOutput = {
  stdout: string
  stderr: string
  exitCode: number
  truncated?: boolean
  fullOutputPath?: string
}

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
 * bites first), UTF-8-safe — a multibyte character is never split.
 * Tail-biased: errors surface at the end of output.
 */
const truncateTail = (text: string): { content: string; truncated: boolean } => {
  const endsWithNewline = text.endsWith('\n')
  let lines = text.split('\n')
  if (endsWithNewline) lines.pop() // phantom '' from the trailing newline — not a line
  let truncated = false
  if (lines.length > MAX_LINES) {
    lines = lines.slice(-MAX_LINES)
    truncated = true
  }
  let content = lines.join('\n')
  if (endsWithNewline) content += '\n'
  const bytes = new TextEncoder().encode(content)
  if (bytes.byteLength > MAX_BYTES) {
    let start = bytes.byteLength - MAX_BYTES
    while (start < bytes.byteLength && (bytes[start]! & 0xc0) === 0x80) start++
    content = new TextDecoder().decode(bytes.subarray(start))
    truncated = true
  }
  return { content, truncated }
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
 * **cwd/env are provision-time, not model-facing**: `run` accepts them so the
 * provisioner can compose a pinned tool (`run: (input) => bashTool.run({
 * ...input, cwd })`); the model-facing inputSchema deliberately excludes them
 * (a model that picks its own directories is a sandbox hole — Phase 5 policy
 * guards gate any model-facing escape hatch later).
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
export const run = async (input: JsonObject & CwdProvision): Promise<{ output: BashOutput }> => {
  // Args are Ajv-validated at dispatch and guard-blocked at selection before
  // this runs — the cast is the documented trust boundary.
  const { command, timeout, cwd, env: extraEnv } = input as BashInput & CwdProvision

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

    /** Tail-truncate; on truncation, spill the full output to the spill dir. */
    const capture = async (raw: string) => {
      const tail = truncateTail(sanitize(raw))
      if (!tail.truncated) return { content: tail.content, truncated: false, fullOutputPath: undefined }
      const spillPath = join(spillDir, 'output.log')
      await Bun.write(spillPath, raw)
      return { ...tail, fullOutputPath: spillPath }
    }

    // Native timeout kills with SIGTERM — surface it as the timeout condition
    if (timeout !== undefined && proc.signalCode !== null) {
      const out = await capture(rawStdout)
      const err = await capture(rawStderr)
      return {
        output: {
          stdout: out.content,
          stderr: `${err.content}\nCommand timed out after ${timeout} seconds (${proc.signalCode})`.trim(),
          exitCode: -1,
          truncated: out.truncated || err.truncated || undefined,
          fullOutputPath: out.fullOutputPath ?? err.fullOutputPath,
        },
      }
    }

    const stdoutTail = await capture(rawStdout)
    const stderrTail = await capture(rawStderr)

    return {
      output: {
        stdout: stdoutTail.content,
        stderr: stderrTail.content,
        exitCode: exitCode ?? -1,
        truncated: stdoutTail.truncated || stderrTail.truncated || undefined,
        fullOutputPath: stdoutTail.fullOutputPath ?? stderrTail.fullOutputPath,
      },
    }
  } catch (err) {
    // Catch unexpected spawn errors (command not found, cwd deleted, etc.)
    return {
      output: {
        stdout: '',
        stderr: `[Error executing command: ${(err as Error).message}]`,
        exitCode: -1,
      },
    }
  }
}

const bashTool: ToolArgs = Object.freeze({
  name: 'bash',
  description:
    'Execute a bash command in the current working directory. Returns stdout, stderr, and exit code. ' +
    `Output is tail-truncated to the last ${MAX_LINES} lines or ${MAX_BYTES / 1024}KB (whichever is hit first). ` +
    `Optional timeout in seconds (max ${MAX_TIMEOUT_SECONDS}); a timed-out command reports exitCode -1.`,
  inputSchema,
  outputSchema,
  run,
})

export default bashTool
