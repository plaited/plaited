/**
 * Bash execution tool for running shell commands.
 *
 * @remarks
 * Provides a safe wrapper around Bun.spawn for executing shell commands
 * with timeout support, custom working directory, and environment variables.
 * Designed for LLM invocation with Zod-validated inputs.
 *
 * @module
 */

import { type ExecInput, ExecInputSchema, type ExecResult } from './bash-exec.schemas.ts'

/**
 * Default timeout for command execution (30 seconds).
 */
const DEFAULT_TIMEOUT_MS = 30_000

/**
 * Executes a shell command and returns the result.
 *
 * @remarks
 * Uses Bun.spawn for shell execution with built-in process management.
 * Captures stdout, stderr, exit code, and execution duration.
 *
 * The command is executed via /bin/sh -c, so pipes and redirects work.
 * Use the `cwd` option to change the working directory.
 * Use the `env` option to set environment variables.
 */
export const exec = async (input: ExecInput): Promise<ExecResult> => {
  const { command, cwd, timeout = DEFAULT_TIMEOUT_MS, env } = ExecInputSchema.parse(input)

  const startTime = performance.now()

  try {
    // Create AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeout)

    // Execute via shell
    const proc = Bun.spawn(['sh', '-c', command], {
      cwd,
      env: env ? { ...process.env, ...env } : process.env,
      stdout: 'pipe',
      stderr: 'pipe',
      signal: controller.signal,
    })

    // Read output streams
    const [stdout, stderr] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text()])

    // Wait for process to complete
    const exitCode = await proc.exited

    clearTimeout(timeoutId)

    const durationMs = Math.round(performance.now() - startTime)

    // Exit code 143 = 128 + 15 (SIGTERM) indicates the process was killed
    // This happens when we abort via the AbortController
    if (exitCode === 143 || controller.signal.aborted) {
      return {
        success: false,
        error: `Command timed out after ${timeout}ms`,
        stdout,
        stderr,
        exitCode,
        command,
        durationMs,
      }
    }

    if (exitCode === 0) {
      return {
        success: true,
        stdout,
        stderr,
        exitCode,
        command,
        durationMs,
      }
    }

    return {
      success: false,
      error: `Command failed with exit code ${exitCode}`,
      stdout,
      stderr,
      exitCode,
      command,
      durationMs,
    }
  } catch (error) {
    const durationMs = Math.round(performance.now() - startTime)
    const message = error instanceof Error ? error.message : String(error)

    // Handle abort (timeout) specifically
    if (message.includes('aborted') || message.includes('abort')) {
      return {
        success: false,
        error: `Command timed out after ${timeout}ms`,
        command,
        durationMs,
      }
    }

    return {
      success: false,
      error: message,
      command,
      durationMs,
    }
  }
}
