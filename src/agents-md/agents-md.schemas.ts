import * as z from 'zod'

const AgentsMdLinkSchema = z
  .object({
    value: z.string().min(1).describe('Normalized local markdown link target from the AGENTS.md body.'),
    text: z.string().min(1).describe('Display text associated with the markdown link target.'),
  })
  .describe('Single local markdown link extracted from an AGENTS.md instruction body.')

const AgentsMdLinksSchema = z
  .object({
    present: z.array(AgentsMdLinkSchema).describe('Local markdown links that resolve to existing files.'),
    missing: z.array(AgentsMdLinkSchema).describe('Local markdown links that do not resolve to existing files.'),
  })
  .describe('Validated local markdown links for one AGENTS.md instruction file.')

const AgentsMdWarningSchema = z
  .object({
    code: z.enum(['missing_local_link']).describe('Non-fatal warning code.'),
    path: z.string().min(1).describe('AGENTS.md path relative to `rootDir` that produced the warning.'),
    link: AgentsMdLinkSchema.describe('Markdown link associated with the warning.'),
    message: z.string().min(1).describe('Human-readable warning message.'),
  })
  .describe('Non-fatal warning emitted during AGENTS.md discovery.')

const AgentsMdEntrySchema = z
  .object({
    path: z.string().min(1).describe('AGENTS.md path relative to `rootDir`.'),
    scope: z
      .string()
      .describe('Directory scope relative to `rootDir` that this AGENTS.md applies to. `.` means repository root.'),
    body: z.string().describe('Raw AGENTS.md body text.'),
    links: AgentsMdLinksSchema.describe('Validated local markdown links referenced by the AGENTS.md body.'),
  })
  .describe('Instruction resource discovered from one AGENTS.md file.')

const AgentsMdBaseInputSchema = z
  .object({
    rootDir: z.string().min(1).describe('Workspace root directory used to discover AGENTS.md files.'),
    ignoreGlobs: z
      .array(z.string().min(1))
      .default([])
      .describe('Additional ignore globs to apply on top of the built-in default ignore patterns.'),
  })
  .describe('Shared input for `agents-md` modes.')

const AgentsMdListInputSchema = AgentsMdBaseInputSchema.extend({
  mode: z.literal('list').describe('Discovers all AGENTS.md files under `rootDir`.'),
}).describe('Input for `agents-md` list mode.')

const AgentsMdRelevantInputSchema = AgentsMdBaseInputSchema.extend({
  mode: z.literal('relevant').describe('Discovers AGENTS.md files relevant to the supplied paths.'),
  paths: z
    .array(z.string().min(1))
    .min(1)
    .describe('Target work paths used only to filter relevant AGENTS.md instruction scopes.'),
}).describe('Input for `agents-md` relevant mode.')

/**
 * Input contract for the `agents-md` CLI.
 *
 * @public
 */
export const AgentsMdCliInputSchema = z
  .union([AgentsMdListInputSchema, AgentsMdRelevantInputSchema])
  .describe('Input for `agents-md`, with mode-discriminated list and relevant contracts.')

/**
 * Parsed input accepted by the `agents-md` CLI.
 *
 * @public
 */
export type AgentsMdCliInput = z.infer<typeof AgentsMdCliInputSchema>

const AgentsMdListOutputSchema = z
  .object({
    mode: z.literal('list').describe('Echoes list mode.'),
    rootDir: z.string().min(1).describe('Normalized absolute root directory used for discovery.'),
    entries: z.array(AgentsMdEntrySchema).describe('Discovered AGENTS.md instruction resources under `rootDir`.'),
    warnings: z.array(AgentsMdWarningSchema).describe('Non-fatal warnings collected during discovery.'),
  })
  .describe('Output for `agents-md` list mode.')

const AgentsMdRelevantOutputSchema = z
  .object({
    mode: z.literal('relevant').describe('Echoes relevant mode.'),
    rootDir: z.string().min(1).describe('Normalized absolute root directory used for discovery.'),
    paths: z.array(z.string().min(1)).describe('Normalized target paths relative to `rootDir`.'),
    entries: z
      .array(AgentsMdEntrySchema)
      .describe('Root plus scope-matching AGENTS.md instruction resources for the supplied target paths.'),
    warnings: z.array(AgentsMdWarningSchema).describe('Non-fatal warnings collected during discovery.'),
  })
  .describe('Output for `agents-md` relevant mode.')

/**
 * Output contract for the `agents-md` CLI.
 *
 * @public
 */
export const AgentsMdCliOutputSchema = z
  .union([AgentsMdListOutputSchema, AgentsMdRelevantOutputSchema])
  .describe('Output for `agents-md`, matching the selected mode result schema.')

/**
 * Structured result emitted by the `agents-md` CLI.
 *
 * @public
 */
export type AgentsMdCliOutput = z.infer<typeof AgentsMdCliOutputSchema>
