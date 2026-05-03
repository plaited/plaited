import * as z from 'zod'

const AgentsLinkSchema = z
  .object({
    value: z.string().min(1).describe('Normalized local markdown link target from the AGENTS.md body.'),
    text: z.string().min(1).describe('Display text associated with the markdown link target.'),
  })
  .describe('Single local markdown link extracted from an AGENTS.md instruction body.')

const AgentsLinksSchema = z
  .object({
    present: z.array(AgentsLinkSchema).describe('Local markdown links that resolve to existing files.'),
    missing: z.array(AgentsLinkSchema).describe('Local markdown links that do not resolve to existing files.'),
  })
  .describe('Validated local markdown links for one AGENTS.md instruction file.')

const AgentsWarningSchema = z
  .object({
    code: z.enum(['missing_local_link']).describe('Non-fatal warning code.'),
    path: z.string().min(1).describe('AGENTS.md path relative to `rootDir` that produced the warning.'),
    link: AgentsLinkSchema.describe('Markdown link associated with the warning.'),
    message: z.string().min(1).describe('Human-readable warning message.'),
  })
  .describe('Non-fatal warning emitted during AGENTS.md discovery.')

const AgentsEntrySchema = z
  .object({
    path: z.string().min(1).describe('AGENTS.md path relative to `rootDir`.'),
    scope: z
      .string()
      .describe('Directory scope relative to `rootDir` that this AGENTS.md applies to. `.` means repository root.'),
    body: z.string().describe('Raw AGENTS.md body text.'),
    links: AgentsLinksSchema.describe('Validated local markdown links referenced by the AGENTS.md body.'),
  })
  .describe('Instruction resource discovered from one AGENTS.md file.')

const AgentsBaseInputSchema = z
  .object({
    rootDir: z.string().min(1).describe('Workspace root directory used to discover AGENTS.md files.'),
    ignoreGlobs: z
      .array(z.string().min(1))
      .default([])
      .describe('Additional ignore globs to apply on top of the built-in default ignore patterns.'),
  })
  .describe('Shared input for `agents` modes.')

const AgentsListInputSchema = AgentsBaseInputSchema.extend({
  mode: z.literal('list').describe('Discovers all AGENTS.md files under `rootDir`.'),
}).describe('Input for `agents` list mode.')

const AgentsRelevantInputSchema = AgentsBaseInputSchema.extend({
  mode: z.literal('relevant').describe('Discovers AGENTS.md files relevant to the supplied paths.'),
  paths: z
    .array(z.string().min(1))
    .min(1)
    .describe('Target work paths used only to filter relevant AGENTS.md instruction scopes.'),
}).describe('Input for `agents` relevant mode.')

export const AgentsCliInputSchema = z
  .union([AgentsListInputSchema, AgentsRelevantInputSchema])
  .describe('Input for `agents`, with mode-discriminated list and relevant contracts.')

export type AgentsCliInput = z.infer<typeof AgentsCliInputSchema>

const AgentsListOutputSchema = z
  .object({
    mode: z.literal('list').describe('Echoes list mode.'),
    rootDir: z.string().min(1).describe('Normalized absolute root directory used for discovery.'),
    entries: z.array(AgentsEntrySchema).describe('Discovered AGENTS.md instruction resources under `rootDir`.'),
    warnings: z.array(AgentsWarningSchema).describe('Non-fatal warnings collected during discovery.'),
  })
  .describe('Output for `agents` list mode.')

const AgentsRelevantOutputSchema = z
  .object({
    mode: z.literal('relevant').describe('Echoes relevant mode.'),
    rootDir: z.string().min(1).describe('Normalized absolute root directory used for discovery.'),
    paths: z.array(z.string().min(1)).describe('Normalized target paths relative to `rootDir`.'),
    entries: z
      .array(AgentsEntrySchema)
      .describe('Root plus scope-matching AGENTS.md instruction resources for the supplied target paths.'),
    warnings: z.array(AgentsWarningSchema).describe('Non-fatal warnings collected during discovery.'),
  })
  .describe('Output for `agents` relevant mode.')

export const AgentsCliOutputSchema = z
  .union([AgentsListOutputSchema, AgentsRelevantOutputSchema])
  .describe('Output for `agents`, matching the selected mode result schema.')

export type AgentsCliOutput = z.infer<typeof AgentsCliOutputSchema>
