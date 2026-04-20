import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import {
  closeContextDatabase,
  exportReviewData,
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

const ExportedContextRunSchema = z
  .object({
    id: z.number().int().positive().describe('Context run row id.'),
    task: z.string().min(1).describe('Task string used for context assembly.'),
    mode: z.string().min(1).describe('Context assembly mode used for the run.'),
    paths: z.array(z.string()).describe('Input paths used by the run.'),
    result: z.unknown().nullable().describe('Serialized run output snapshot.'),
    createdAt: z.string().min(1).describe('Creation timestamp in ISO format.'),
  })
  .describe('Recorded context assembly run included in export.')

export const ExportReviewInputSchema = OperationalContextOverrideSchema.extend({
  status: z
    .array(FindingStatusSchema)
    .min(1)
    .default(['candidate', 'validated', 'retired'])
    .describe('Finding statuses to include in the export.'),
  format: z.enum(['json']).default('json').describe('Export format.'),
}).describe('Input contract for exporting findings and context runs.')

export const ExportReviewOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates export completed successfully.'),
    format: z.literal('json').describe('Exported output format.'),
    dbPath: z.string().min(1).describe('Resolved writable SQLite DB path.'),
    exportedAt: z.string().min(1).describe('Export timestamp in ISO format.'),
    findings: z.array(ExportedFindingSchema).describe('Exported findings matching selected statuses.'),
    contextRuns: z.array(ExportedContextRunSchema).describe('Exported context run history.'),
  })
  .describe('Output contract for review export.')

export type ExportReviewInput = z.infer<typeof ExportReviewInputSchema>
export type ExportReviewOutput = z.infer<typeof ExportReviewOutputSchema>

export const exportReview = async (input: ExportReviewInput): Promise<ExportReviewOutput> => {
  const context = await resolveOperationalContext(input)
  const db = await openContextDatabase({ dbPath: context.dbPath })

  try {
    const exported = exportReviewData({
      db,
      statuses: input.status,
    })

    return {
      ok: true,
      format: 'json',
      dbPath: context.dbPath,
      exportedAt: new Date().toISOString(),
      findings: exported.findings,
      contextRuns: exported.contextRuns,
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
