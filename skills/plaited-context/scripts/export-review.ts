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

const ExportedEvidenceSchema = z.object({
  path: z.string().min(1),
  line: z.number().int().positive().optional(),
  symbol: z.string().min(1).optional(),
  excerpt: z.string().min(1).optional(),
})

const ExportedFindingSchema = z.object({
  id: z.number().int().positive(),
  kind: FindingKindSchema,
  status: FindingStatusSchema,
  summary: z.string().min(1),
  details: z.string().nullable(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  evidence: z.array(ExportedEvidenceSchema),
})

const ExportedContextRunSchema = z.object({
  id: z.number().int().positive(),
  task: z.string().min(1),
  mode: z.string().min(1),
  paths: z.array(z.string()),
  result: z.unknown().nullable(),
  createdAt: z.string().min(1),
})

export const ExportReviewInputSchema = OperationalContextOverrideSchema.extend({
  status: z.array(FindingStatusSchema).min(1).default(['candidate', 'validated', 'retired']),
  format: z.enum(['json']).default('json'),
})

export const ExportReviewOutputSchema = z.object({
  ok: z.literal(true),
  format: z.literal('json'),
  dbPath: z.string().min(1),
  exportedAt: z.string().min(1),
  findings: z.array(ExportedFindingSchema),
  contextRuns: z.array(ExportedContextRunSchema),
})

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
