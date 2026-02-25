import { z } from 'zod'

export const SearchConfigSchema = z.object({
  query: z.string().describe('FTS5 search query — supports AND, OR, NOT operators and porter stemming'),
  dbPath: z.string().optional().describe('Path to SQLite database (default: .plaited/memory.db)'),
  workspace: z.string().optional().describe('Workspace root for file indexing (default: cwd)'),
  limit: z.number().optional().default(20).describe('Maximum number of results (default: 20)'),
})
