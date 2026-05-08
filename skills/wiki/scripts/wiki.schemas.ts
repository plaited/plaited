import * as z from 'zod'

const WikiBaseInputSchema = z
  .object({
    rootDir: z.string().min(1).default('.').describe('Workspace root directory used for wiki scanning.'),
    paths: z.array(z.string().min(1)).default(['docs']).describe('Paths under rootDir to scan for markdown files.'),
    ignore: z.array(z.string().min(1)).default([]).describe('Additional ignore glob patterns applied during scan.'),
  })
  .strict()

const WikiContextInputSchema = WikiBaseInputSchema.extend({
  mode: z.literal('context').describe('Ranks markdown pages relevant to the provided task.'),
  task: z.string().min(1).describe('Task statement used for wiki relevance ranking.'),
}).describe('Input for wiki context mode.')

const WikiDiagnoseInputSchema = WikiBaseInputSchema.extend({
  mode: z.literal('diagnose').describe('Diagnoses local markdown link quality and cleanup warnings.'),
}).describe('Input for wiki diagnose mode.')

export const WikiCliInputSchema = z
  .discriminatedUnion('mode', [WikiContextInputSchema, WikiDiagnoseInputSchema])
  .describe('Input for `wiki` command.')

export type WikiCliInput = z.infer<typeof WikiCliInputSchema>

const WikiPageSchema = z
  .object({
    path: z.string().min(1).describe('Markdown file path relative to rootDir.'),
    title: z.string().min(1).describe('Resolved title for the page.'),
    headings: z.array(z.string()).describe('Heading strings discovered in the page.'),
    outboundLocalReferences: z.array(z.string()).describe('Normalized local link targets.'),
    reason: z.string().min(1).describe('Deterministic inclusion reason.'),
    matchedTerms: z.array(z.string()).describe('Task terms that matched this page.'),
  })
  .describe('Wiki page analysis result.')

const WikiWarningSchema = z
  .object({
    kind: z
      .enum(['broken-local-link', 'missing-target-file', 'retired-skill-reference', 'orphan-page'])
      .describe('Wiki cleanup warning kind.'),
    path: z.string().min(1).describe('Relative markdown page path that produced the warning.'),
    message: z.string().min(1).describe('Deterministic warning message.'),
    linkValue: z.string().min(1).optional().describe('Original markdown link value when relevant.'),
    targetPath: z.string().min(1).nullable().optional().describe('Normalized target path when resolvable.'),
  })
  .describe('Wiki cleanup warning row.')

const WikiOutputBaseSchema = z
  .object({
    mode: z.enum(['context', 'diagnose']).describe('Mode that produced this result.'),
    pages: z.array(WikiPageSchema).describe('Page analysis rows for the requested paths.'),
    warnings: z.array(WikiWarningSchema).describe('Non-fatal link and cleanup warnings.'),
    suggestedNextCommands: z
      .array(z.string().min(1))
      .describe('Suggested follow-up commands to cross-check wiki findings with stronger sources.'),
  })
  .strict()

export const WikiCliOutputSchema = WikiOutputBaseSchema.describe('Output for `wiki` command.')

export type WikiCliOutput = z.infer<typeof WikiCliOutputSchema>
