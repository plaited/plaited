import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import { readCachedEvidenceRow } from './cache-evidence.ts'
import {
  closeContextDatabase,
  FindingKindSchema,
  FindingStatusSchema,
  OperationalContextOverrideSchema,
  openContextDatabase,
  resolveOperationalContext,
} from './plaited-context.ts'

const ExportedEvidenceSchema = z
  .object({
    path: z.string().min(1).describe('Source file path for this evidence row.'),
    line: z.number().int().positive().optional().describe('Optional 1-based line number.'),
    symbol: z.string().min(1).optional().describe('Optional symbol tied to evidence.'),
    excerpt: z.string().min(1).optional().describe('Optional short source excerpt.'),
  })
  .describe('Evidence row included in a review export.')

const ExportedFindingSchema = z
  .object({
    id: z.number().int().positive().describe('Finding row id.'),
    kind: FindingKindSchema.describe('Finding classification.'),
    status: FindingStatusSchema.describe('Finding lifecycle status.'),
    summary: z.string().min(1).describe('Short finding summary.'),
    details: z.string().nullable().describe('Optional long-form details.'),
    createdAt: z.string().min(1).describe('Creation timestamp in ISO format.'),
    updatedAt: z.string().min(1).describe('Last update timestamp in ISO format.'),
    evidence: z.array(ExportedEvidenceSchema).describe('Evidence rows attached to this finding.'),
  })
  .describe('Finding row included in a review export.')

const ExportedCachedEvidenceSchema = z
  .object({
    id: z.number().int().positive().describe('Cache row id.'),
    tool: z.string().min(1).describe('Evidence producer name.'),
    topic: z.string().min(1).describe('Topic label for this row.'),
    key: z.string().nullable().describe('Optional deterministic key for keyed cache rows.'),
    summary: z.string().nullable().describe('Optional reviewer summary text.'),
    command: z.string().nullable().describe('Optional collection command.'),
    tags: z.array(z.string()).describe('Tag labels attached to this row.'),
    input: z.unknown().describe('Cached producer input payload.'),
    output: z.unknown().describe('Cached producer output payload.'),
    createdAt: z.string().min(1).describe('Creation timestamp in ISO format.'),
    updatedAt: z.string().min(1).describe('Last update timestamp in ISO format.'),
  })
  .describe('Cached top-level plaited evidence row included in export.')

export const ExportReviewInputSchema = OperationalContextOverrideSchema.extend({
  status: z
    .array(FindingStatusSchema)
    .min(1)
    .default(['candidate', 'validated', 'retired'])
    .describe('Finding statuses to include in the export.'),
  format: z.enum(['json']).default('json').describe('Export format.'),
  cacheLimit: z.number().int().positive().max(1000).default(100).describe('Maximum cached evidence rows to include.'),
}).describe('Input contract for exporting persisted findings and cached top-level evidence.')

export const ExportReviewOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates export completed successfully.'),
    format: z.literal('json').describe('Exported output format.'),
    dbPath: z.string().min(1).describe('Resolved writable SQLite DB path.'),
    exportedAt: z.string().min(1).describe('Export timestamp in ISO format.'),
    findings: z.array(ExportedFindingSchema).describe('Exported findings matching selected statuses.'),
    cachedEvidence: z.array(ExportedCachedEvidenceSchema).describe('Exported cached top-level evidence rows.'),
  })
  .describe('Output contract for review export.')

export type ExportReviewInput = z.input<typeof ExportReviewInputSchema>
export type ExportReviewOutput = z.infer<typeof ExportReviewOutputSchema>

export const exportReview = async (input: ExportReviewInput): Promise<ExportReviewOutput> => {
  const status = input.status ?? ['candidate', 'validated', 'retired']
  const cacheLimit = input.cacheLimit ?? 100
  const context = await resolveOperationalContext(input)
  const db = await openContextDatabase({ dbPath: context.dbPath })

  try {
    const placeholders = status.map(() => '?').join(', ')
    const findings = db
      .query(
        `SELECT id, kind, status, summary, details, created_at, updated_at
         FROM findings
         WHERE status IN (${placeholders})
         ORDER BY id ASC`,
      )
      .all(...status) as Array<{
      id: number
      kind: z.infer<typeof FindingKindSchema>
      status: z.infer<typeof FindingStatusSchema>
      summary: string
      details: string | null
      created_at: string
      updated_at: string
    }>

    const evidenceRows = db
      .query(
        `SELECT finding_id, path, line, symbol, excerpt
         FROM finding_evidence
         WHERE finding_id IN (${findings.map(() => '?').join(', ') || 'NULL'})
         ORDER BY id ASC`,
      )
      .all(...findings.map((finding) => finding.id)) as Array<{
      finding_id: number
      path: string
      line: number | null
      symbol: string | null
      excerpt: string | null
    }>

    const evidenceByFinding = new Map<number, Array<z.infer<typeof ExportedEvidenceSchema>>>()
    for (const evidence of evidenceRows) {
      const collection = evidenceByFinding.get(evidence.finding_id) ?? []
      collection.push(
        ExportedEvidenceSchema.parse({
          path: evidence.path,
          line: evidence.line ?? undefined,
          symbol: evidence.symbol ?? undefined,
          excerpt: evidence.excerpt ?? undefined,
        }),
      )
      evidenceByFinding.set(evidence.finding_id, collection)
    }

    const cachedEvidenceRows = db
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
         ORDER BY id DESC
         LIMIT ?`,
      )
      .all(cacheLimit) as Array<{
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

    const cachedEvidence = cachedEvidenceRows.map((row) => readCachedEvidenceRow(row))

    return {
      ok: true,
      format: 'json',
      dbPath: context.dbPath,
      exportedAt: new Date().toISOString(),
      findings: findings.map((finding) => ({
        id: finding.id,
        kind: finding.kind,
        status: finding.status,
        summary: finding.summary,
        details: finding.details,
        createdAt: finding.created_at,
        updatedAt: finding.updated_at,
        evidence: evidenceByFinding.get(finding.id) ?? [],
      })),
      cachedEvidence,
    }
  } finally {
    closeContextDatabase(db)
  }
}

export const exportReviewCli = makeCli({
  name: 'skills/plaited-context/scripts/export-review.ts',
  inputSchema: ExportReviewInputSchema,
  outputSchema: ExportReviewOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/export-review.ts '{"status":["candidate","validated"],"format":"json"}'`,
    `  bun skills/plaited-context/scripts/export-review.ts --schema output`,
  ].join('\n'),
  run: exportReview,
})

if (import.meta.main) {
  await exportReviewCli(Bun.argv.slice(2))
}
