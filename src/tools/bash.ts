import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as z from 'zod'
import { useMCPServer } from './use-mcp-server.ts'

// ================================================================
// Limits (mirroring pi's bash tool + read tool conventions)
// ================================================================

/** Spawn timeouts are int32 milliseconds — cap seconds accordingly. */
const MAX_TIMEOUT_SECONDS = 2_147_483 // ≈ int32 ms / 1000
const MAX_LINES = 2000
const MAX_BYTES = 50 * 1024

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
 * Registered via `useMCPServer` as the `bash` MCP tool. `cwd` is a required
 * input field — always provided by the provisioner, never model-chosen.
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
export const bash = useMCPServer((server) => {
  server.registerTool(
    BASH_NAME,
    {
      description:
        'Execute a bash command in the current working directory. Returns stdout, stderr, and exit code. ' +
        `Output is tail-truncated to the last ${MAX_LINES} lines or ${MAX_BYTES / 1024}KB (whichever is hit first). ` +
        `Optional timeout in seconds (max ${MAX_TIMEOUT_SECONDS}); a timed-out command reports exitCode -1.`,
      inputSchema: z.object({
        command: z.string().min(1).describe('bash command to execute'),
        cwd: z.string().describe("the tool's provisioned cwd"),
        env: z.record(z.string(), z.string()).optional(),
        timeout: z
          .number()
          .int()
          .min(1)
          .max(MAX_TIMEOUT_SECONDS)
          .optional()
          .describe(`timeout in seconds (optional, no default; max ${MAX_TIMEOUT_SECONDS})`),
      }),
      outputSchema: z.object({
        stdout: z.string(),
        stderr: z.string(),
        exitCode: z.number().int(),
        truncated: z
          .boolean()
          .optional()
          .describe('true when output exceeded the tail-truncation limits (last 2000 lines / 50KB)'),
        fullOutputPath: z
          .string()
          .optional()
          .describe('absolute path to the untruncated output — present only when truncated'),
      }),
    },
    async ({ command, timeout, cwd, env: extraEnv }) => {
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
          const output = {
            stdout: out.content,
            stderr: `${err.content}\nCommand timed out after ${timeout} seconds (${proc.signalCode})`.trim(),
            exitCode: -1,
            truncated: out.truncated || err.truncated || undefined,
            fullOutputPath: out.fullOutputPath ?? err.fullOutputPath,
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          }
        }

        const stdoutTail = await capture(rawStdout)
        const stderrTail = await capture(rawStderr)
        const output = {
          stdout: stdoutTail.content,
          stderr: stderrTail.content,
          exitCode: exitCode ?? -1,
          truncated: stdoutTail.truncated || stderrTail.truncated || undefined,
          fullOutputPath: stdoutTail.fullOutputPath ?? stderrTail.fullOutputPath,
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (err) {
        // Catch unexpected spawn errors (command not found, cwd deleted, etc.)
        const output = {
          stdout: '',
          stderr: `[Error executing command: ${(err as Error).message}]`,
          exitCode: -1,
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }
    },
  )
})
