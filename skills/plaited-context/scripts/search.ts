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

const SearchResultSchema = z
  .object({
    source: z.enum(['file', 'doc', 'finding', 'rg']).describe('Search source for this result row.'),
    path: z.string().optional().describe('Optional source file path for the hit.'),
    line: z.number().int().positive().optional().describe('Optional 1-based line number for the hit.'),
    symbol: z.string().optional().describe('Optional symbol associated with the hit.'),
    findingId: z.number().int().positive().optional().describe('Optional finding id when source is a finding.'),
    status: z
      .enum(['candidate', 'validated', 'retired'])
      .optional()
      .describe('Finding lifecycle status when applicable.'),
    kind: z
      .enum(['pattern', 'anti-pattern', 'stale-doc', 'boundary-rule', 'question'])
      .optional()
      .describe('Finding classification when applicable.'),
    summary: z.string().optional().describe('Optional finding summary when applicable.'),
    snippet: z.string().describe('Text snippet representing the match.'),
  })
  .describe('Single search result entry.')

export const SearchInputSchema = OperationalContextOverrideSchema.extend({
  query: z.string().min(1).describe('Query string to search for in indexed context.'),
  limit: z.number().int().positive().max(500).default(20).describe('Maximum number of results to return.'),
  rootDir: z.string().min(1).default('.').describe('Workspace root for optional ripgrep fallback scanning.'),
  fallbackToRipgrep: z.boolean().default(true).describe('When true, runs ripgrep if indexed search has no hits.'),
}).describe('Input contract for indexed search with optional ripgrep fallback.')

export const SearchOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates search completed successfully.'),
    dbPath: z.string().min(1).describe('Resolved writable SQLite DB path.'),
    query: z.string().min(1).describe('Echo of the executed query.'),
    results: z.array(SearchResultSchema).describe('Ordered list of search results.'),
    fallbackUsed: z.boolean().describe('True when ripgrep fallback produced returned results.'),
  })
  .describe('Output contract for context search.')

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
