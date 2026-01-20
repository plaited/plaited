/**
 * Zod schemas for bash execution tools.
 *
 * @remarks
 * Provides type-safe input validation for shell command execution.
 * These schemas define the expected parameters for LLM-invokable bash tools.
 *
 * @module
 */

import { z } from 'zod'

/**
 * Schema for executing a bash command.
 */
export const ExecInputSchema = z.object({
  command: z.string().describe('Shell command to execute'),
  cwd: z.string().optional().describe('Working directory for the command'),
  timeout: z.number().optional().describe('Timeout in milliseconds (default: 30000)'),
  env: z.record(z.string(), z.string()).optional().describe('Environment variables to set'),
})

/**
 * Input type for bash execution.
 */
export type ExecInput = z.infer<typeof ExecInputSchema>

/**
 * Result of a bash execution.
 */
export type ExecResult =
  | {
      success: true
      stdout: string
      stderr: string
      exitCode: number
      command: string
      durationMs: number
    }
  | {
      success: false
      error: string
      stdout?: string
      stderr?: string
      exitCode?: number
      command: string
      durationMs?: number
    }
