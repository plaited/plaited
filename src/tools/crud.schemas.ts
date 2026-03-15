import * as z from 'zod'
import { TruncationResultSchema } from './truncate.ts'

// ============================================================================
// Input Schemas
// ============================================================================

export const ReadFileConfigSchema = z.object({
  path: z.string().describe('Relative path to the file'),
  offset: z.number().optional().describe('Line offset to start reading from (0-indexed)'),
  limit: z.number().optional().describe('Maximum number of lines to return'),
})

export const WriteFileConfigSchema = z.object({
  path: z.string().describe('Relative path to the file'),
  content: z.string().describe('Content to write to the file'),
})

export const EditFileConfigSchema = z.object({
  path: z.string().describe('Relative path to the file'),
  old_string: z.string().describe('Exact string to find (must appear exactly once in file)'),
  new_string: z.string().describe('Replacement string'),
  symbol: z.string().optional().describe('Export name to scope the search to (uses Bun.Transpiler.scan)'),
})

export const ListFilesConfigSchema = z.object({
  pattern: z.string().optional().describe('Glob pattern (defaults to **/* if omitted)'),
  limit: z.number().optional().describe('Maximum number of entries to return (defaults to 1000)'),
})

export const BashConfigSchema = z.object({
  command: z.string().describe('The shell command to execute'),
})

// ============================================================================
// Output Schemas
// ============================================================================

export const ReadFileOutputSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('text'),
    path: z.string(),
    ...TruncationResultSchema.shape,
  }),
  z.object({
    type: z.literal('image'),
    path: z.string(),
    mimeType: z.string(),
    size: z.number(),
  }),
  z.object({
    type: z.literal('binary'),
    path: z.string(),
    mimeType: z.string(),
    size: z.number(),
  }),
])

export const BashOutputSchema = z.object({
  ...TruncationResultSchema.shape,
})

export const WriteFileOutputSchema = z.object({
  written: z.string(),
  bytes: z.number(),
})

export const EditFileOutputSchema = z.object({
  edited: z.string(),
  bytes: z.number(),
})

export const ListFilesEntrySchema = z.object({
  path: z.string(),
  type: z.enum(['file', 'directory']),
  size: z.number().optional(),
})

export const ListFilesOutputSchema = z.object({
  entries: z.array(ListFilesEntrySchema),
  truncated: z.boolean(),
  totalEntries: z.number(),
  returnedEntries: z.number(),
})
