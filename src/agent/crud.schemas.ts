import * as z from 'zod'
import { TruncationResultSchema } from '../tools/truncate.ts'

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

export const GrepConfigSchema = z.object({
  pattern: z.string().describe('Regex or literal search pattern'),
  path: z.string().optional().describe('Directory or file to search (default: workspace root)'),
  glob: z.string().optional().describe('Filter files by glob pattern (e.g. "*.ts")'),
  ignoreCase: z.boolean().optional().describe('Case-insensitive search'),
  literal: z.boolean().optional().describe('Treat pattern as literal string, not regex'),
  context: z.number().optional().describe('Lines of context before and after each match'),
  limit: z.number().optional().describe('Maximum number of matches to return (default: 100)'),
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
  mimeType: z.string().optional(),
})

export const ListFilesOutputSchema = z.object({
  entries: z.array(ListFilesEntrySchema),
  truncated: z.boolean(),
  totalEntries: z.number(),
  returnedEntries: z.number(),
})

export const GrepMatchSchema = z.object({
  path: z.string(),
  line: z.number(),
  text: z.string(),
  context: z
    .object({
      before: z.array(z.string()).optional(),
      after: z.array(z.string()).optional(),
    })
    .optional(),
})

export const GrepOutputSchema = z.object({
  matches: z.array(GrepMatchSchema),
  totalMatches: z.number(),
  truncated: z.boolean(),
})
