import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import { readCachedEvidenceRow } from './cache-evidence.ts'
import {
  closeContextDatabase,
  OperationalContextOverrideSchema,
  openContextDatabase,
  resolveOperationalContext,
} from './plaited-context.ts'

const CacheSortSchema = z.enum(['newest', 'oldest']).describe('Ordering mode for matching cache rows.')

const escapeLike = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')

const QueryCacheEntrySchema = z
  .object({
    id: z.number().int().positive().describe('Cache row id.'),
    tool: z.string().min(1).describe('Evidence producer name.'),
    topic: z.string().min(1).describe('Topic label for this row.'),
    key: z.string().nullable().describe('Optional deterministic key for upserted rows.'),
    summary: z.string().nullable().describe('Optional summary text.'),
    command: z.string().nullable().describe('Optional collection command.'),
    tags: z.array(z.string()).describe('Tags attached to this row.'),
    createdAt: z.string().min(1).describe('Row creation timestamp in ISO format.'),
    updatedAt: z.string().min(1).describe('Row update timestamp in ISO format.'),
    input: z.unknown().optional().describe('Input payload when includePayload is true.'),
    output: z.unknown().optional().describe('Output payload when includePayload is true.'),
  })
  .describe('Normalized cache query row.')

export const QueryCacheInputSchema = OperationalContextOverrideSchema.extend({
  tool: z.string().min(1).optional().describe('Optional exact tool filter.'),
  topic: z.string().min(1).optional().describe('Optional exact topic filter.'),
  key: z.string().min(1).optional().describe('Optional exact key filter.'),
  text: z
    .string()
    .min(1)
    .optional()
    .describe('Optional full-text-like filter over summary, command, and serialized payload.'),
  tags: z.array(z.string().min(1)).max(32).default([]).describe('Optional tag filters (row must contain all tags).'),
  limit: z.number().int().positive().max(200).default(20).describe('Maximum rows to return.'),
  sort: CacheSortSchema.default('newest').describe('Sort order for matching rows.'),
  includePayload: z.boolean().default(true).describe('Include stored input/output payloads in returned rows.'),
}).describe('Input contract for querying cached top-level evidence rows.')

export const QueryCacheOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates query completed successfully.'),
    dbPath: z.string().min(1).describe('Resolved writable SQLite DB path.'),
    count: z.number().int().nonnegative().describe('Number of returned rows.'),
    entries: z.array(QueryCacheEntrySchema).describe('Matching cache rows.'),
  })
  .describe('Output contract for query-cache.')

export type QueryCacheInput = z.input<typeof QueryCacheInputSchema>
export type QueryCacheOutput = z.infer<typeof QueryCacheOutputSchema>

export const queryCache = async (input: QueryCacheInput): Promise<QueryCacheOutput> => {
  const parsed = QueryCacheInputSchema.parse(input)
  const context = await resolveOperationalContext(parsed)
  const db = await openContextDatabase({ dbPath: context.dbPath })

  try {
    const whereClauses: string[] = []
    const values: string[] = []

    if (parsed.tool) {
      whereClauses.push('tool = ?')
      values.push(parsed.tool)
    }

    if (parsed.topic) {
      whereClauses.push('topic = ?')
      values.push(parsed.topic)
    }

    if (parsed.key) {
      whereClauses.push('cache_key = ?')
      values.push(parsed.key)
    }

    if (parsed.text) {
      const pattern = `%${escapeLike(parsed.text)}%`
      whereClauses.push(
        `(summary LIKE ? ESCAPE '\\' COLLATE NOCASE
        OR command LIKE ? ESCAPE '\\' COLLATE NOCASE
        OR input_json LIKE ? ESCAPE '\\' COLLATE NOCASE
        OR output_json LIKE ? ESCAPE '\\' COLLATE NOCASE)`,
      )
      values.push(pattern, pattern, pattern, pattern)
    }

    for (const tag of parsed.tags) {
      whereClauses.push(`tags_json LIKE ? ESCAPE '\\' COLLATE NOCASE`)
      values.push(`%${escapeLike(JSON.stringify(tag).slice(1, -1))}%`)
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''
    const sortSql = parsed.sort === 'oldest' ? 'ORDER BY id ASC' : 'ORDER BY id DESC'
    const rows = db
      .query(
        `SELECT id,
                tool,
                topic,
                cache_key,
                summary,
                command,
                tags_json,
                input_json,
                output_json,
                created_at,
                updated_at
         FROM evidence_cache
         ${whereSql}
         ${sortSql}
         LIMIT ?`,
      )
      .all(...values, parsed.limit) as Array<{
      id: number
      tool: string
      topic: string
      cache_key: string | null
      summary: string | null
      command: string | null
      tags_json: string
      input_json: string
      output_json: string
      created_at: string
      updated_at: string
    }>

    const entries = rows.map((row) => {
      const parsedRow = readCachedEvidenceRow(row)
      if (parsed.includePayload) {
        return parsedRow
      }

      return {
        id: parsedRow.id,
        tool: parsedRow.tool,
        topic: parsedRow.topic,
        key: parsedRow.key,
        summary: parsedRow.summary,
        command: parsedRow.command,
        tags: parsedRow.tags,
        createdAt: parsedRow.createdAt,
        updatedAt: parsedRow.updatedAt,
      }
    })

    return {
      ok: true,
      dbPath: context.dbPath,
      count: entries.length,
      entries: QueryCacheEntrySchema.array().parse(entries),
    }
  } finally {
    closeContextDatabase(db)
  }
}

export const queryCacheCli = makeCli({
  name: 'skills/plaited-context/scripts/query-cache.ts',
  inputSchema: QueryCacheInputSchema,
  outputSchema: QueryCacheOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/query-cache.ts '{"tool":"git","topic":"context","limit":10}'`,
    `  bun skills/plaited-context/scripts/query-cache.ts '{"text":"worker","tags":["review"],"includePayload":false}'`,
    `  bun skills/plaited-context/scripts/query-cache.ts --schema output`,
  ].join('\n'),
  run: queryCache,
})

if (import.meta.main) {
  await queryCacheCli(Bun.argv.slice(2))
}
