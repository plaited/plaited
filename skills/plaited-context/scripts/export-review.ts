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

const ContextAuthorityEntrySchema = z
  .object({
    rank: z.number().int().positive().describe('Authority rank where lower is stronger.'),
    authority: z
      .enum(['source', 'agent-instructions', 'skill', 'wiki', 'other'])
      .describe('Authority source classification.'),
    label: z.string().min(1).describe('Short authority label.'),
    description: z.string().min(1).describe('Authority explanation.'),
  })
  .describe('Single authority ordering entry.')

const WikiBrokenLinkSchema = z
  .object({
    path: z.string().min(1).describe('Wiki page that contains the broken local link.'),
    linkValue: z.string().min(1).describe('Raw markdown link value.'),
    linkText: z.string().min(1).describe('Extracted display text for the link.'),
    targetPath: z.string().nullable().describe('Normalized target path when resolvable.'),
    reason: z.string().min(1).describe('Reason the link is treated as broken.'),
    authority: z.literal('wiki').describe('Authority category for this warning.'),
    provenance: z.array(z.string()).describe('Evidence paths used to produce this warning.'),
  })
  .describe('Broken wiki local-link evidence row.')

const WikiCleanupCandidateSchema = z
  .object({
    path: z.string().min(1).describe('Wiki page path requiring cleanup review.'),
    kind: z
      .enum(['broken-local-link', 'missing-target-file', 'retired-skill-reference', 'orphan-page'])
      .describe('Deterministic cleanup candidate kind.'),
    reason: z.string().min(1).describe('Cleanup rationale.'),
    authority: z.literal('wiki').describe('Authority category for this candidate.'),
    provenance: z.array(z.string()).describe('Evidence references supporting the candidate.'),
  })
  .describe('Wiki cleanup candidate for human review.')

const WikiContextPageSchema = z
  .object({
    path: z.string().min(1).describe('Wiki page path.'),
    title: z.string().min(1).describe('Wiki page title (parsed or inferred).'),
    reason: z.string().min(1).describe('Why this page is relevant to the task.'),
    authority: z.literal('wiki').describe('Authority category for wiki pages.'),
    headings: z.array(z.string()).describe('Captured markdown headings.'),
    outboundLocalReferences: z.array(z.string()).describe('Captured outbound local references.'),
    warnings: z.array(z.string()).describe('Cleanup warnings related to this page.'),
    provenance: z
      .object({
        matchedTerms: z.array(z.string()).describe('Task terms that matched this page.'),
        matchedIn: z
          .array(z.enum(['path', 'title', 'heading', 'body', 'outbound-link', 'task-path']))
          .describe('Fields where task-term matches were observed.'),
      })
      .describe('Deterministic relevance provenance.'),
  })
  .describe('Relevant wiki page entry.')

const WikiContextSchema = z
  .object({
    ok: z.literal(true).describe('Indicates wiki context assembly completed successfully.'),
    wikiPages: z.array(WikiContextPageSchema).describe('Relevant wiki pages for the task.'),
    agentInstructions: z
      .array(
        z.object({
          path: z.string().min(1).describe('AGENTS instruction file path.'),
          scopePath: z.string().min(1).describe('Scoped path governed by this AGENTS file.'),
          authority: z.literal('agent-instructions').describe('Authority category.'),
          reason: z.string().min(1).describe('Reason this AGENTS file is relevant.'),
          provenance: z.array(z.string()).describe('Deterministic relevance evidence.'),
        }),
      )
      .describe('Relevant AGENTS operational instructions.'),
    skills: z
      .array(
        z.object({
          name: z.string().min(1).describe('Skill name.'),
          path: z.string().min(1).describe('Skill path.'),
          authority: z.literal('skill').describe('Authority category.'),
          reason: z.string().min(1).describe('Reason this skill is relevant.'),
          provenance: z.array(z.string()).describe('Deterministic relevance evidence.'),
        }),
      )
      .describe('Relevant skills for this task.'),
    sourceOfTruth: z.array(ContextAuthorityEntrySchema).describe('Explicit source authority ordering.'),
    authorityPolicy: z
      .string()
      .min(1)
      .describe('Conflict policy describing why code/AGENTS/skills outrank wiki assertions.'),
    brokenLinks: z.array(WikiBrokenLinkSchema).describe('Broken wiki local-link evidence.'),
    cleanupCandidates: z.array(WikiCleanupCandidateSchema).describe('Wiki cleanup candidate evidence.'),
    openQuestions: z.array(z.string()).describe('Open follow-up questions for reviewers.'),
  })
  .describe('Wiki review context export for deterministic human review.')

export const ExportReviewInputSchema = OperationalContextOverrideSchema.extend({
  status: z
    .array(FindingStatusSchema)
    .min(1)
    .default(['candidate', 'validated', 'retired'])
    .describe('Finding statuses to include in the export.'),
  format: z.enum(['json']).default('json').describe('Export format.'),
  wikiTask: z.string().min(1).default('review repository wiki context').describe('Wiki relevance task prompt.'),
  wikiPaths: z.array(z.string().min(1)).default([]).describe('Optional task paths for wiki relevance scoping.'),
  wikiLimit: z.number().int().positive().max(100).default(10).describe('Maximum wiki pages to include in review.'),
}).describe('Input contract for exporting findings and context runs.')

export const ExportReviewOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates export completed successfully.'),
    format: z.literal('json').describe('Exported output format.'),
    dbPath: z.string().min(1).describe('Resolved writable SQLite DB path.'),
    exportedAt: z.string().min(1).describe('Export timestamp in ISO format.'),
    findings: z.array(ExportedFindingSchema).describe('Exported findings matching selected statuses.'),
    contextRuns: z.array(ExportedContextRunSchema).describe('Exported context run history.'),
    wikiContext: WikiContextSchema.describe('Wiki review evidence and relevance context.'),
  })
  .describe('Output contract for review export.')

export type ExportReviewInput = z.input<typeof ExportReviewInputSchema>
export type ExportReviewOutput = z.infer<typeof ExportReviewOutputSchema>

export const exportReview = async (input: ExportReviewInput): Promise<ExportReviewOutput> => {
  const status = input.status ?? ['candidate', 'validated', 'retired']
  const wikiTask = input.wikiTask ?? 'review repository wiki context'
  const wikiPaths = input.wikiPaths ?? []
  const wikiLimit = input.wikiLimit ?? 10
  const context = await resolveOperationalContext(input)
  const db = await openContextDatabase({ dbPath: context.dbPath })

  try {
    const exported = exportReviewData({
      db,
      statuses: status,
      wikiTask,
      wikiPaths,
      wikiLimit,
    })

    return {
      ok: true,
      format: 'json',
      dbPath: context.dbPath,
      exportedAt: new Date().toISOString(),
      findings: exported.findings,
      contextRuns: exported.contextRuns,
      wikiContext: exported.wikiContext,
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
