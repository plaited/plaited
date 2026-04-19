import { resolve } from 'node:path'
import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import {
  closeContextDatabase,
  OperationalContextOverrideSchema,
  openContextDatabase,
  resolveOperationalContext,
  searchContextDatabase,
  searchWithRipgrep,
} from './plaited-context.ts'

const SearchResultSchema = z.object({
  source: z.enum(['file', 'doc', 'finding', 'rg']),
  path: z.string().optional(),
  line: z.number().int().positive().optional(),
  symbol: z.string().optional(),
  findingId: z.number().int().positive().optional(),
  status: z.enum(['candidate', 'validated', 'retired']).optional(),
  kind: z.enum(['pattern', 'anti-pattern', 'stale-doc', 'boundary-rule', 'question']).optional(),
  summary: z.string().optional(),
  snippet: z.string(),
})

export const SearchInputSchema = OperationalContextOverrideSchema.extend({
  query: z.string().min(1),
  limit: z.number().int().positive().max(500).default(20),
  rootDir: z.string().min(1).default('.'),
  fallbackToRipgrep: z.boolean().default(true),
})

export const SearchOutputSchema = z.object({
  ok: z.literal(true),
  dbPath: z.string().min(1),
  query: z.string().min(1),
  results: z.array(SearchResultSchema),
  fallbackUsed: z.boolean(),
})

export type SearchInput = z.infer<typeof SearchInputSchema>
export type SearchOutput = z.infer<typeof SearchOutputSchema>

export const searchWorkspace = async (input: SearchInput): Promise<SearchOutput> => {
  const context = await resolveOperationalContext(input)
  const db = await openContextDatabase({ dbPath: context.dbPath })

  try {
    const indexedResults = searchContextDatabase({
      db,
      query: input.query,
      limit: input.limit,
    })

    if (indexedResults.length > 0 || !input.fallbackToRipgrep) {
      return {
        ok: true,
        dbPath: context.dbPath,
        query: input.query,
        results: indexedResults,
        fallbackUsed: false,
      }
    }

    const fallbackResults = await searchWithRipgrep({
      rootDir: resolve(context.cwd, input.rootDir),
      query: input.query,
      limit: input.limit,
    })

    return {
      ok: true,
      dbPath: context.dbPath,
      query: input.query,
      results: fallbackResults,
      fallbackUsed: fallbackResults.length > 0,
    }
  } finally {
    closeContextDatabase(db)
  }
}

export const searchCli = makeCli({
  name: 'skills/plaited-context/scripts/search.ts',
  inputSchema: SearchInputSchema,
  outputSchema: SearchOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/search.ts '{"query":"useSnapshot reportSnapshot","limit":20}'`,
    `  bun skills/plaited-context/scripts/search.ts --schema input`,
  ].join('\n'),
  run: searchWorkspace,
})

if (import.meta.main) {
  await searchCli(Bun.argv.slice(2))
}
