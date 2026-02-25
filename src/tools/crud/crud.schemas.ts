import { z } from 'zod'

export const ReadFileConfigSchema = z.object({
  path: z.string().describe('Relative path to the file'),
})

export const WriteFileConfigSchema = z.object({
  path: z.string().describe('Relative path to the file'),
  content: z.string().describe('Content to write to the file'),
})

export const ListFilesConfigSchema = z.object({
  pattern: z.string().optional().describe('Glob pattern (defaults to **/* if omitted)'),
})

export const BashConfigSchema = z.object({
  command: z.string().describe('The shell command to execute'),
})
