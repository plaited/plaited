import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'
import {
  assembleWikiContext,
  closeContextDatabase,
  OperationalContextOverrideSchema,
  openContextDatabase,
  resolveOperationalContext,
} from './plaited-context.ts'

const WikiContextPageSchema = z
  .object({
    path: z.string().min(1).describe('Wiki page path.'),
    title: z.string().min(1).describe('Parsed or inferred wiki title.'),
    reason: z.string().min(1).describe('Deterministic relevance reason.'),
    authority: z.literal('wiki').describe('Authority classification for wiki pages.'),
    headings: z.array(z.string()).describe('Captured markdown headings.'),
    outboundLocalReferences: z.array(z.string()).describe('Captured outbound local references.'),
    warnings: z.array(z.string()).describe('Cleanup warnings for this page.'),
    provenance: z
      .object({
        matchedTerms: z.array(z.string()).describe('Task terms that matched this page.'),
        matchedIn: z
          .array(z.enum(['path', 'title', 'heading', 'body', 'outbound-link', 'task-path']))
          .describe('Fields where task terms matched.'),
      })
      .describe('Deterministic relevance provenance.'),
  })
  .describe('Wiki relevance entry.')

const WikiContextAgentInstructionSchema = z
  .object({
    path: z.string().min(1).describe('AGENTS file path.'),
    scopePath: z.string().min(1).describe('Scoped path for this instruction file.'),
    authority: z.literal('agent-instructions').describe('Authority classification.'),
    reason: z.string().min(1).describe('Reason this instruction file is relevant.'),
    provenance: z.array(z.string()).describe('Deterministic evidence for inclusion.'),
  })
  .describe('Relevant AGENTS instruction entry.')

const WikiContextSkillSchema = z
  .object({
    name: z.string().min(1).describe('Skill name.'),
    path: z.string().min(1).describe('Skill path.'),
    authority: z.literal('skill').describe('Authority classification.'),
    reason: z.string().min(1).describe('Reason this skill is relevant.'),
    provenance: z.array(z.string()).describe('Matched terms used for inclusion.'),
  })
  .describe('Relevant skill entry.')

const ContextAuthoritySchema = z
  .object({
    rank: z.number().int().positive().describe('Authority rank where lower numbers are stronger authority.'),
    authority: z
      .enum(['source', 'agent-instructions', 'skill', 'wiki', 'other'])
      .describe('Authority source category.'),
    label: z.string().min(1).describe('Short authority label.'),
    description: z.string().min(1).describe('Authority summary text.'),
  })
  .describe('Single source-of-truth authority layer.')

const WikiBrokenLinkSchema = z
  .object({
    path: z.string().min(1).describe('Wiki page that contains the broken local link.'),
    linkValue: z.string().min(1).describe('Raw markdown link value.'),
    linkText: z.string().min(1).describe('Display text for the markdown link.'),
    targetPath: z.string().nullable().describe('Normalized target path when resolvable.'),
    reason: z.string().min(1).describe('Reason this link is considered broken.'),
    authority: z.literal('wiki').describe('Authority category for wiki link warnings.'),
    provenance: z.array(z.string()).describe('Deterministic evidence used for this warning.'),
  })
  .describe('Broken local-link report row.')

const WikiCleanupCandidateSchema = z
  .object({
    path: z.string().min(1).describe('Wiki page path needing cleanup review.'),
    kind: z
      .enum(['broken-local-link', 'missing-target-file', 'retired-skill-reference', 'orphan-page'])
      .describe('Cleanup candidate classification.'),
    reason: z.string().min(1).describe('Cleanup recommendation reason.'),
    authority: z.literal('wiki').describe('Authority category for cleanup candidates.'),
    provenance: z.array(z.string()).describe('Deterministic evidence supporting this candidate.'),
  })
  .describe('Wiki cleanup recommendation entry.')

export const WikiContextInputSchema = OperationalContextOverrideSchema.extend({
  task: z.string().min(1).describe('Task statement used to rank wiki relevance.'),
  paths: z.array(z.string().min(1)).default([]).describe('Optional task paths used for scope overlap ranking.'),
  limit: z.number().int().positive().max(100).default(10).describe('Maximum wiki pages to return.'),
}).describe('Input contract for deterministic wiki context assembly.')

export const WikiContextOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates wiki context assembly succeeded.'),
    wikiPages: z.array(WikiContextPageSchema).describe('Relevant wiki pages for the task.'),
    agentInstructions: z
      .array(WikiContextAgentInstructionSchema)
      .describe('Applicable AGENTS operational instructions for the task scope.'),
    skills: z.array(WikiContextSkillSchema).describe('Relevant skills discovered by task terms.'),
    sourceOfTruth: z.array(ContextAuthoritySchema).describe('Explicit source authority order.'),
    authorityPolicy: z
      .string()
      .min(1)
      .describe('Conflict policy describing why code/AGENTS/skills outrank wiki assertions.'),
    brokenLinks: z.array(WikiBrokenLinkSchema).describe('Broken wiki local-link evidence rows.'),
    cleanupCandidates: z.array(WikiCleanupCandidateSchema).describe('Deterministic wiki cleanup candidates.'),
    openQuestions: z.array(z.string()).describe('Open questions requiring human review.'),
  })
  .describe('Output contract for wiki-oriented context assembly.')

export type WikiContextInput = z.infer<typeof WikiContextInputSchema>
export type WikiContextOutput = z.infer<typeof WikiContextOutputSchema>

export const assembleWikiTaskContext = async (input: WikiContextInput): Promise<WikiContextOutput> => {
  const { task, paths, limit, ...contextOverrides } = input
  const context = await resolveOperationalContext(contextOverrides)
  const db = await openContextDatabase({ dbPath: context.dbPath })

  try {
    return assembleWikiContext({
      db,
      task,
      paths,
      limit,
    })
  } finally {
    closeContextDatabase(db)
  }
}

export const wikiContextCli = makeCli({
  name: 'skills/plaited-context/scripts/wiki-context.ts',
  inputSchema: WikiContextInputSchema,
  outputSchema: WikiContextOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/wiki-context.ts '{"task":"review runtime boundary architecture","paths":["src/worker"],"limit":10}'`,
    `  bun skills/plaited-context/scripts/wiki-context.ts --schema input`,
    `  bun skills/plaited-context/scripts/wiki-context.ts --schema output`,
  ].join('\n'),
  run: assembleWikiTaskContext,
})

if (import.meta.main) {
  await wikiContextCli(Bun.argv.slice(2))
}
