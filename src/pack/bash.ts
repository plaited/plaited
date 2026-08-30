import * as z from 'zod'
import type { ToolArgs } from './pack.types.ts'

export const inputSchema = z.object({
  command: z.string().min(1, 'command must be non-empty'),
  timeout: z.number().int().positive().optional().describe('timeout in seconds (no default timeout)'),
})

export const outputSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.number().int(),
})

export type BashInput = z.output<typeof inputSchema>
export type BashOutput = z.output<typeof outputSchema>

/** Signal codes from process termination. */
const signalName = (code: number): string => {
  const sig = code - 128
  // Common signal names
  const names: Record<number, string> = {
    1: 'SIGHUP',
    2: 'SIGINT',
    3: 'SIGQUIT',
    6: 'SIGABRT',
    9: 'SIGKILL',
    15: 'SIGTERM',
  }
  return names[sig] ?? `SIG${sig}`
}

/**
 * Execute a shell command via `Bun.spawn` with optional timeout.
 *
 * `Bun.$` does not support AbortSignal or timeout natively, so we use
 * `Bun.spawn` with a shell wrapper for command execution. Non-zero exit
 * codes are returned as data — never thrown.
 *
 * When the process is killed by a timeout signal, the exit code is >128
 * (128 + signal number). We detect this and report the timeout condition
 * in stderr.
 *
 * MINIMAL: no CWD config, no env customization. Upgrade path: add `cwd`
 * and `env` fields to inputSchema.
 */
export const run = async (input: BashInput): Promise<BashOutput> => {
  const { command, timeout } = input

  let signal: AbortSignal | undefined
  if (timeout !== undefined) {
    signal = AbortSignal.timeout(timeout * 1000)
  }

  try {
    const proc = Bun.spawn(['bash', '-c', command], {
      signal,
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])

    const exitCode = await proc.exited

    // If the process was killed by a signal due to timeout, report it
    if (signal?.aborted ?? false) {
      return {
        stdout,
        stderr: stderr || `Command timed out after ${timeout} seconds (killed by ${signalName(exitCode)})`,
        exitCode: -1,
      }
    }

    return {
      stdout,
      stderr,
      exitCode,
    }
  } catch (err) {
    // Catch unexpected spawn errors (command not found, etc.)
    return {
      stdout: '',
      stderr: `[Error executing command: ${(err as Error).message}]`,
      exitCode: -1,
    }
  }
}

const bashTool: ToolArgs<typeof inputSchema, typeof outputSchema> = Object.freeze({
  name: 'bash',
  description: 'Execute a bash command in the current working directory. Returns stdout, stderr, and exit code.',
  inputSchema,
  outputSchema,
  run,
})

export default bashTool
