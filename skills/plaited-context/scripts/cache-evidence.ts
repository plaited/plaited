import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import {
  closeContextDatabase,
  OperationalContextOverrideSchema,
  openContextDatabase,
  resolveOperationalContext,
} from './plaited-context.ts'

const nowIso = (): string => new Date().toISOString()

const parseJson = <T>(value: string): T => JSON.parse(value) as T

const stringArrayToJson = (values: string[]): string => JSON.stringify(values)

const unknownToJson = (value: unknown): string => JSON.stringify(value ?? null)

const CacheEvidenceRecordSchema = z
  .object({
    id: z.number().int().positive().describe('Cache row id.'),
    createdAt: z.string().min(1).describe('Row creation timestamp in ISO format.'),
    updatedAt: z.string().min(1).describe('Row update timestamp in ISO format.'),
    replaced: z.boolean().describe('True when an existing keyed row was replaced.'),
  })
  .describe('Cache write result metadata.')

export const CacheEvidenceInputSchema = OperationalContextOverrideSchema.extend({
  tool: z.string().min(1).describe('Top-level evidence producer name (for example git, wiki, skills).'),
  topic: z.string().min(1).describe('Short topic label for this evidence snapshot (for example context or catalog).'),
  key: z
    .string()
    .min(1)
    .optional()
    .describe('Optional deterministic key. When set, writes are upserted by tool+topic+key.'),
  summary: z.string().min(1).optional().describe('Optional reviewer-facing summary for this evidence row.'),
  command: z.string().min(1).optional().describe('Optional command string used to collect this evidence.'),
  tags: z.array(z.string().min(1)).max(32).default([]).describe('Optional tags for later filtering.'),
  input: z.unknown().describe('JSON input payload sent to the evidence producer.'),
  output: z.unknown().describe('JSON output payload returned by the evidence producer.'),
}).describe('Input contract for caching top-level plaited evidence output.')

export const CacheEvidenceOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates cache write completed successfully.'),
    dbPath: z.string().min(1).describe('Resolved writable SQLite DB path.'),
    record: CacheEvidenceRecordSchema,
  })
  .describe('Output contract for cache-evidence writes.')

export type CacheEvidenceInput = z.input<typeof CacheEvidenceInputSchema>
export type CacheEvidenceOutput = z.infer<typeof CacheEvidenceOutputSchema>

export const cacheEvidence = async (input: CacheEvidenceInput): Promise<CacheEvidenceOutput> => {
  const parsed = CacheEvidenceInputSchema.parse(input)
  const context = await resolveOperationalContext(parsed)
  const db = await openContextDatabase({ dbPath: context.dbPath })

  try {
    const timestamp = nowIso()
    const existingRow =
      parsed.key === undefined
        ? null
        : (db
            .query(
              `SELECT id, created_at
               FROM evidence_cache
               WHERE tool = ? AND topic = ? AND cache_key = ?`,
            )
            .get(parsed.tool, parsed.topic, parsed.key) as { id: number; created_at: string } | null)

    const serializedInput = unknownToJson(parsed.input)
    const serializedOutput = unknownToJson(parsed.output)
    const serializedTags = stringArrayToJson(parsed.tags)

    if (existingRow) {
      db.query(
        `UPDATE evidence_cache
         SET summary = ?,
             command = ?,
             tags_json = ?,
             input_json = ?,
             output_json = ?,
             updated_at = ?
         WHERE id = ?`,
      ).run(
        parsed.summary ?? null,
        parsed.command ?? null,
        serializedTags,
        serializedInput,
        serializedOutput,
        timestamp,
        existingRow.id,
      )

      return {
        ok: true,
        dbPath: context.dbPath,
        record: {
          id: existingRow.id,
          createdAt: existingRow.created_at,
          updatedAt: timestamp,
          replaced: true,
        },
      }
    }

    const result = db
      .query(
        `INSERT INTO evidence_cache (
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
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        parsed.tool,
        parsed.topic,
        parsed.key ?? null,
        parsed.summary ?? null,
        parsed.command ?? null,
        serializedTags,
        serializedInput,
        serializedOutput,
        timestamp,
        timestamp,
      )

    return {
      ok: true,
      dbPath: context.dbPath,
      record: {
        id: Number(result.lastInsertRowid),
        createdAt: timestamp,
        updatedAt: timestamp,
        replaced: false,
      },
    }
  } finally {
    closeContextDatabase(db)
  }
}

const CacheEvidenceRowSchema = z
  .object({
    id: z.number().int().positive(),
    tool: z.string().min(1),
    topic: z.string().min(1),
    key: z.string().nullable(),
    summary: z.string().nullable(),
    command: z.string().nullable(),
    tags: z.array(z.string()),
    input: z.unknown(),
    output: z.unknown(),
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .describe('Normalized evidence cache row.')

type CacheEvidenceRow = z.infer<typeof CacheEvidenceRowSchema>

export const readCachedEvidenceRow = (row: {
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
}): CacheEvidenceRow =>
  CacheEvidenceRowSchema.parse({
    id: row.id,
    tool: row.tool,
    topic: row.topic,
    key: row.cache_key,
    summary: row.summary,
    command: row.command,
    tags: parseJson<string[]>(row.tags_json),
    input: parseJson<unknown>(row.input_json),
    output: parseJson<unknown>(row.output_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  })

export const cacheEvidenceCli = makeCli({
  name: 'skills/plaited-context/scripts/cache-evidence.ts',
  inputSchema: CacheEvidenceInputSchema,
  outputSchema: CacheEvidenceOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/cache-evidence.ts '{"tool":"git","topic":"context","key":"src/worker","command":"bun ./bin/plaited.ts git \\"{...}\\"","input":{"mode":"context"},"output":{"ok":true},"tags":["review"]}'`,
    `  bun skills/plaited-context/scripts/cache-evidence.ts --schema input`,
  ].join('\n'),
  run: cacheEvidence,
})

if (import.meta.main) {
  await cacheEvidenceCli(Bun.argv.slice(2))
}
