import * as z from 'zod'

// ============================================================================
// Input Schemas
// ============================================================================

export const ReadFileConfigSchema = z.object({
  path: z.string().describe('Relative path to the file'),
})

export const WriteFileConfigSchema = z.object({
  path: z.string().describe('Relative path to the file'),
  content: z.string().describe('Content to write to the file'),
})

export const EditFileConfigSchema = z.object({
  path: z.string().describe('Relative path to the file'),
  old_string: z.string().describe('Exact string to find (must appear exactly once in file)'),
  new_string: z.string().describe('Replacement string'),
})

export const ListFilesConfigSchema = z.object({
  pattern: z.string().optional().describe('Glob pattern (defaults to **/* if omitted)'),
})

export const BashConfigSchema = z.object({
  command: z.string().describe('The shell command to execute'),
})

// ============================================================================
// Output Schemas
// ============================================================================

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

export const ListFilesOutputSchema = z.array(ListFilesEntrySchema)
