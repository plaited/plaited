import * as z from 'zod'

export const SkillDirectoryPathSchema = z
  .string()
  .min(1)
  .describe('Absolute skill directory path. Each directory contains a SKILL.md file.')

/** @public */
export type SkillDirectoryPath = z.infer<typeof SkillDirectoryPathSchema>

export const SkillDirectoryPathsSchema = z
  .array(SkillDirectoryPathSchema)
  .describe('Sorted absolute skill directory paths discovered under a workspace root.')

/** @public */
export type SkillDirectoryPaths = z.infer<typeof SkillDirectoryPathsSchema>

/**
 * Compact skill metadata exposed for discovery and selection.
 *
 * @public
 */
export const SkillCatalogEntrySchema = z
  .object({
    name: z.string().min(1).describe('Skill identifier from frontmatter `name`.'),
    description: z.string().min(1).describe('Short skill summary from frontmatter `description`.'),
    path: z.string().min(1).describe('`/`-prefixed SKILL.md path relative to the catalog `rootDir`.'),
  })
  .describe('Catalog entry for one valid skill discovered from SKILL.md frontmatter.')

/** @public */
export type SkillCatalogEntry = z.infer<typeof SkillCatalogEntrySchema>

/**
 * Compact skill metadata exposed for discovery and selection.
 *
 * @public
 */
export const SkillCatalogErrorSchema = z
  .object({
    message: z.string().min(1).describe('Validation or parsing error for the referenced skill markdown file.'),
    path: z.string().min(1).describe('`/`-prefixed SKILL.md path relative to the catalog `rootDir`.'),
  })
  .describe('Validation error for a skill that could not be included in the catalog.')

/** @public */
export type SkillCatalogError = z.infer<typeof SkillCatalogErrorSchema>

export const SkillMetaSchema = z
  .object({
    license: z.string().min(1).describe('Optional license metadata for the skill.').optional(),
    compatibility: z.string().min(1).describe('Optional runtime or tooling compatibility notes.').optional(),
    allowedTools: z.string().min(1).describe('Optional list of allowed tool classes for skill usage.').optional(),
    metadata: z
      .record(z.string(), z.string())
      .describe('Optional additional frontmatter key/value metadata.')
      .optional(),
  })
  .describe('Optional metadata fields parsed from skill frontmatter.')

/** @public */
export type SkillMeta = z.infer<typeof SkillMetaSchema>

export const SkillInstructionSchema = z
  .object({
    body: z.string().describe('Markdown body content from SKILL.md with frontmatter removed.'),
  })
  .describe('Parsed skill instruction content.')

/** @public */
export type SkillInstruction = z.infer<typeof SkillInstructionSchema>

export const SkillResourceLinkSchema = z
  .object({
    value: z.string().min(1).describe('Normalized local link target path.'),
    text: z.string().min(1).describe('Display label resolved from link text or fallback target path.'),
  })
  .describe('Single local resource link referenced by skill instructions.')

/** @public */
export type SkillResourceLink = z.infer<typeof SkillResourceLinkSchema>

export const SkillResourceLinksSchema = z
  .object({
    present: z.set(SkillResourceLinkSchema).describe('Set of local links that resolved to existing files.'),
    missing: z.set(SkillResourceLinkSchema).describe('Set of local links that did not resolve to files.'),
  })
  .describe('Validation result for local resource links referenced by a skill.')

/** @public */
export type SkillResourceLinks = z.infer<typeof SkillResourceLinksSchema>

export const SkillValidationStatusSchema = z
  .boolean()
  .describe('True when skill markdown passes frontmatter validation.')

/** @public */
export type SkillValidationStatus = z.infer<typeof SkillValidationStatusSchema>

export const SkillCatalogLoadResultSchema = z
  .object({
    catalog: z.array(SkillCatalogEntrySchema).describe('Valid skills discovered under the requested root directory.'),
    errors: z
      .array(SkillCatalogErrorSchema)
      .describe('Invalid skills discovered during scan, with path-scoped validation errors.'),
  })
  .describe('Skill catalog discovery result with valid entries and structured validation errors.')

/** @public */
export type SkillCatalogLoadResult = z.infer<typeof SkillCatalogLoadResultSchema>

export const SkillsCatalogCliInputSchema = z
  .object({
    rootDir: z.string().min(1).describe('Workspace root directory used to discover `skills/*` and `.agents/skills/*`.'),
  })
  .describe('Input for `skills-catalog`.')

/** @public */
export type SkillsCatalogCliInput = z.infer<typeof SkillsCatalogCliInputSchema>

export const SkillsCatalogCliOutputSchema = SkillCatalogLoadResultSchema.describe('Output for `skills-catalog`.')

/** @public */
export type SkillsCatalogCliOutput = z.infer<typeof SkillsCatalogCliOutputSchema>

export const SkillInstructionsResultSchema = z
  .string()
  .describe('Raw markdown instruction body from a valid skill SKILL.md file.')

/** @public */
export type SkillInstructionsResult = z.infer<typeof SkillInstructionsResultSchema>

export const SkillInstructionsLoadResultSchema = SkillInstructionsResultSchema.optional()

/** @public */
export type SkillInstructionsLoadResult = z.infer<typeof SkillInstructionsLoadResultSchema>

export const SkillFrontmatterResultSchema = z
  .record(z.string(), z.unknown())
  .describe('Parsed SKILL.md YAML frontmatter object.')

/** @public */
export type SkillFrontmatterResult = z.infer<typeof SkillFrontmatterResultSchema>

export const SkillFrontmatterLoadResultSchema = SkillFrontmatterResultSchema.optional()

/** @public */
export type SkillFrontmatterLoadResult = z.infer<typeof SkillFrontmatterLoadResultSchema>

export const SkillInstructionErrorSchema = z
  .object({
    skillPath: z.string().min(1).describe('Resolved path to the SKILL.md file that produced the error.'),
    message: z.string().min(1).describe('Validation, parsing, or file-resolution error message.'),
  })
  .describe('Structured error for a specific SKILL.md file.')

/** @public */
export type SkillInstructionError = z.infer<typeof SkillInstructionErrorSchema>

export const SkillInstructionErrorsSchema = z
  .array(SkillInstructionErrorSchema)
  .describe('Zero or more skill-scoped errors collected while loading or validating instructions.')

/** @public */
export type SkillInstructionErrors = z.infer<typeof SkillInstructionErrorsSchema>

export const SkillsValidateCliInputSchema = z
  .object({
    skillPath: z.string().min(1).describe('Path to a specific SKILL.md file to validate.'),
  })
  .describe('Input for `skills-validate`.')

/** @public */
export type SkillsValidateCliInput = z.infer<typeof SkillsValidateCliInputSchema>

export const SkillsValidateCliOutputSchema = z
  .object({
    ok: z.boolean().describe('True when the target SKILL.md passes frontmatter and directory-name validation.'),
    errors: z.array(z.string().min(1)).describe('Validation error messages. Empty when `ok` is true.'),
  })
  .describe('Output for `skills-validate`.')

/** @public */
export type SkillsValidateCliOutput = z.infer<typeof SkillsValidateCliOutputSchema>

export const SkillsLinksCliInputSchema = z
  .object({
    rootDir: z.string().min(1).describe('Workspace root directory used to resolve the skill directory path.'),
    path: z
      .string()
      .min(1)
      .describe('Skill directory path relative to `rootDir` (for example `skills/typescript-lsp`).'),
  })
  .describe('Input for `skills-links`.')

/** @public */
export type SkillsLinksCliInput = z.infer<typeof SkillsLinksCliInputSchema>

export const SkillResourceLinksJsonSchema = z
  .object({
    present: z.array(SkillResourceLinkSchema).describe('Resolved local links converted to JSON array output.'),
    missing: z.array(SkillResourceLinkSchema).describe('Missing local links converted to JSON array output.'),
  })
  .describe('JSON-serializable link validation result.')

/** @public */
export type SkillResourceLinksJson = z.infer<typeof SkillResourceLinksJsonSchema>

export const SkillsLinksCliOutputSchema = z
  .object({
    links: SkillResourceLinksJsonSchema.describe('Present and missing local links referenced by the skill body.'),
    errors: SkillInstructionErrorsSchema.describe('Validation errors encountered while loading or parsing the skill.'),
  })
  .describe('Output for `skills-links`.')

/** @public */
export type SkillsLinksCliOutput = z.infer<typeof SkillsLinksCliOutputSchema>

export const SkillsInstructionsCliInputSchema = z
  .object({
    rootDir: z.string().min(1).describe('Workspace root directory used to resolve the skill directory path.'),
    path: z
      .string()
      .min(1)
      .describe('Skill directory path relative to `rootDir` (for example `skills/typescript-lsp`).'),
  })
  .describe('Input for `skills-instructions`.')

/** @public */
export type SkillsInstructionsCliInput = z.infer<typeof SkillsInstructionsCliInputSchema>

export const SkillsInstructionsCliOutputSchema = z
  .object({
    body: z
      .string()
      .nullable()
      .describe('Markdown body content when loaded successfully. Null when the file is missing or invalid.'),
    errors: SkillInstructionErrorsSchema.describe('File and validation errors encountered during load.'),
  })
  .describe('Output for `skills-instructions`.')

/** @public */
export type SkillsInstructionsCliOutput = z.infer<typeof SkillsInstructionsCliOutputSchema>

export const SkillsFrontmatterCliInputSchema = z
  .object({
    rootDir: z.string().min(1).describe('Workspace root directory used to resolve the skill directory path.'),
    path: z
      .string()
      .min(1)
      .describe('Skill directory path relative to `rootDir` (for example `skills/typescript-lsp`).'),
  })
  .describe('Input for `skills-frontmatter`.')

/** @public */
export type SkillsFrontmatterCliInput = z.infer<typeof SkillsFrontmatterCliInputSchema>

export const SkillsFrontmatterCliOutputSchema = z
  .object({
    frontmatter: SkillFrontmatterResultSchema.nullable().describe(
      'Parsed frontmatter object when loaded successfully. Null when the file is missing or invalid.',
    ),
    errors: SkillInstructionErrorsSchema.describe('File and validation errors encountered during load.'),
  })
  .describe('Output for `skills-frontmatter`.')

/** @public */
export type SkillsFrontmatterCliOutput = z.infer<typeof SkillsFrontmatterCliOutputSchema>

export const SkillInstructionResourceLinksResultSchema = z
  .object({
    links: SkillResourceLinksSchema.describe('Set-based link validation output for internal/library usage.'),
    errors: SkillInstructionErrorsSchema.describe('Validation errors encountered while loading instructions.'),
  })
  .describe('Internal skill resource link load result.')

/** @public */
export type SkillInstructionResourceLinksResult = z.infer<typeof SkillInstructionResourceLinksResultSchema>

export const SkillInstructionResourceLinksLoadResultSchema = SkillInstructionResourceLinksResultSchema.optional()

/** @public */
export type SkillInstructionResourceLinksLoadResult = z.infer<typeof SkillInstructionResourceLinksLoadResultSchema>

/**
 * Zod schema for skill markdown frontmatter.
 *
 * @public
 */
export const SkillFrontMatterSchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(64)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Name must contain only lowercase letters, numbers, and single hyphens')
      .describe('Canonical skill name. Must match the parent directory name.'),
    description: z.string().min(1).max(1024).describe('Human-readable summary of the skill purpose.'),
    license: z.string().min(1).describe('Optional license declaration for the skill.').optional(),
    compatibility: z
      .string()
      .min(1)
      .max(500)
      .describe('Optional runtime/tooling compatibility notes for operators and agents.')
      .optional(),
    'allowed-tools': z.string().min(1).describe('Optional allowlist of tools intended for skill execution.').optional(),
    metadata: z.record(z.string(), z.string()).describe('Optional arbitrary metadata string map.').optional(),
  })
  .describe('Validated YAML frontmatter contract for SKILL.md files.')

/** @public */
export type SkillFrontMatter = z.infer<typeof SkillFrontMatterSchema>
