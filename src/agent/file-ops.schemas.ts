/**
 * Zod schemas for file operation tools.
 *
 * @remarks
 * Provides type-safe input validation for file read, write, and edit operations.
 * These schemas define the expected parameters for LLM-invokable file tools.
 *
 * @module
 */

import { z } from 'zod'

/**
 * Schema for reading a file.
 */
export const ReadFileInputSchema = z.object({
  path: z.string().describe('Absolute or relative file path to read'),
  startLine: z.number().optional().describe('Starting line number (1-indexed)'),
  endLine: z.number().optional().describe('Ending line number (inclusive)'),
})

/**
 * Input type for reading a file.
 */
export type ReadFileInput = z.infer<typeof ReadFileInputSchema>

/**
 * Schema for writing a file.
 */
export const WriteFileInputSchema = z.object({
  path: z.string().describe('Absolute or relative file path to write'),
  content: z.string().describe('Content to write to the file'),
  createDirs: z.boolean().optional().describe('Create parent directories if they do not exist'),
})

/**
 * Input type for writing a file.
 */
export type WriteFileInput = z.infer<typeof WriteFileInputSchema>

/**
 * Schema for editing a file with string replacement.
 */
export const EditFileInputSchema = z.object({
  path: z.string().describe('Absolute or relative file path to edit'),
  oldString: z.string().describe('Exact string to find and replace'),
  newString: z.string().describe('Replacement string'),
  replaceAll: z.boolean().optional().describe('Replace all occurrences (default: false, replaces first only)'),
})

/**
 * Input type for editing a file.
 */
export type EditFileInput = z.infer<typeof EditFileInputSchema>

/**
 * Result of a file read operation.
 */
export type ReadFileResult =
  | {
      success: true
      content: string
      path: string
      lines?: { start: number; end: number; total: number }
    }
  | {
      success: false
      error: string
      path: string
    }

/**
 * Result of a file write operation.
 */
export type WriteFileResult =
  | {
      success: true
      path: string
      bytesWritten: number
    }
  | {
      success: false
      error: string
      path: string
    }

/**
 * Result of a file edit operation.
 */
export type EditFileResult =
  | {
      success: true
      path: string
      replacements: number
    }
  | {
      success: false
      error: string
      path: string
    }
