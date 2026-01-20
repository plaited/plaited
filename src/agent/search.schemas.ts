/**
 * Zod schemas for search operation tools.
 *
 * @remarks
 * Provides type-safe input validation for glob and grep operations.
 * These schemas define the expected parameters for LLM-invokable search tools.
 *
 * @module
 */

import { z } from 'zod'

/**
 * Schema for glob file pattern matching.
 */
export const GlobInputSchema = z.object({
  pattern: z.string().describe('Glob pattern to match files (e.g., "**/*.ts", "src/**/*.tsx")'),
  cwd: z.string().optional().describe('Working directory (defaults to process.cwd())'),
  ignore: z.array(z.string()).optional().describe('Patterns to ignore (e.g., ["node_modules/**"])'),
})

/**
 * Input type for glob operations.
 */
export type GlobInput = z.infer<typeof GlobInputSchema>

/**
 * Schema for grep content search.
 */
export const GrepInputSchema = z.object({
  pattern: z.string().describe('Regex pattern or literal string to search for'),
  path: z.string().optional().describe('File or directory path to search (defaults to current directory)'),
  glob: z.string().optional().describe('File glob pattern to filter (e.g., "*.ts")'),
  ignoreCase: z.boolean().optional().describe('Case-insensitive search'),
  maxResults: z.number().optional().describe('Maximum number of results to return'),
  context: z.number().optional().describe('Lines of context around matches'),
})

/**
 * Input type for grep operations.
 */
export type GrepInput = z.infer<typeof GrepInputSchema>

/**
 * Result of a glob operation.
 */
export type GlobResult =
  | {
      success: true
      files: string[]
      pattern: string
      count: number
    }
  | {
      success: false
      error: string
      pattern: string
    }

/**
 * A single grep match.
 */
export type GrepMatch = {
  file: string
  line: number
  content: string
  context?: {
    before: string[]
    after: string[]
  }
}

/**
 * Result of a grep operation.
 */
export type GrepResult =
  | {
      success: true
      matches: GrepMatch[]
      pattern: string
      count: number
    }
  | {
      success: false
      error: string
      pattern: string
    }
