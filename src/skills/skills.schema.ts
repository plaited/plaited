import * as z from 'zod'

const isSafeRelativeCommandPath = (command: string): boolean => {
  const normalized = command.replace(/\\/g, '/')
  if (normalized.startsWith('/')) return false
  if (/^[A-Za-z]:\//.test(normalized)) return false
  if (/[^\x21-\x7E]/.test(normalized)) return false
  if (/[\s"'`$&|;<>()[\]{}*!?]/.test(normalized)) return false
  return normalized.split('/').every((segment) => segment !== '..' && segment.length > 0)
}

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

export const SkillManifestOriginSourceSchema = z
  .object({
    type: z.string().min(1).describe('Source kind for generated skill provenance, such as `remote-mcp`.'),
    url: z.string().min(1).describe('Source URL used to generate the skill capability package.'),
  })
  .describe('Origin source metadata for a generated skill manifest.')

/** @public */
export type SkillManifestOriginSource = z.infer<typeof SkillManifestOriginSourceSchema>

export const SkillManifestOriginSchema = z
  .object({
    kind: z.literal('generated').describe('Origin classification for generated skills.'),
    source: SkillManifestOriginSourceSchema.describe('Source metadata used for generation.'),
  })
  .describe('Generated skill origin block parsed from `plaited.skill.json`.')

/** @public */
export type SkillManifestOrigin = z.infer<typeof SkillManifestOriginSchema>

export const SkillManifestCapabilityHandlerSchema = z
  .object({
    type: z.literal('cli').describe('Capability handler kind.'),
    command: z
      .string()
      .min(1)
      .refine(isSafeRelativeCommandPath, {
        message:
          'Command must be a non-empty relative path token without whitespace, shell metacharacters, absolute prefixes, empty segments, or parent traversal.',
      })
      .describe('Executable command path for CLI-backed capabilities.'),
  })
  .describe('CLI handler metadata for a generated capability.')

/** @public */
export type SkillManifestCapabilityHandler = z.infer<typeof SkillManifestCapabilityHandlerSchema>

export const SkillManifestCapabilitySourceSchema = z
  .object({
    type: z.string().min(1).describe('Capability source kind, such as `remote-mcp`.'),
    tool: z.string().min(1).optional().describe('Optional remote tool identifier tied to the capability.'),
  })
  .describe('Source attribution metadata for one generated capability.')

/** @public */
export type SkillManifestCapabilitySource = z.infer<typeof SkillManifestCapabilitySourceSchema>

export const SkillManifestCapabilitySchema = z
  .object({
    id: z.string().min(1).describe('Capability identifier inside the skill package.'),
    type: z
      .enum(['cli', 'service', 'ui', 'resource', 'workflow', 'behavioral-spec'])
      .describe('Canonical capability type for generated skills.'),
    lane: z.enum(['private', 'exchange']).describe('Runtime lane designation for this capability.'),
    phase: z
      .enum(['context', 'analysis', 'execution', 'validation', 'generation'])
      .describe('Execution phase where this capability is intended to run.'),
    audience: z.array(z.string().min(1)).min(1).describe('Allowed audience roles for this capability.'),
    actions: z.array(z.string().min(1)).min(1).describe('Action verbs the capability supports.'),
    sideEffects: z
      .enum(['none', 'read-only', 'workspace-write', 'network', 'service', 'external-state'])
      .describe('Declared side-effect profile for this capability.'),
    handler: SkillManifestCapabilityHandlerSchema.describe('Capability handler runtime metadata.'),
    source: SkillManifestCapabilitySourceSchema.describe('Capability source attribution metadata.'),
  })
  .refine((capability) => capability.type === 'cli', {
    path: ['type'],
    message: 'Only `type: "cli"` capabilities are currently supported until non-CLI handler schemas are added.',
  })
  .describe('Capability entry from a generated skill manifest.')

/** @public */
export type SkillManifestCapability = z.infer<typeof SkillManifestCapabilitySchema>

export const GeneratedSkillManifestSchema = z
  .object({
    kind: z.literal('generated-skill').describe('Manifest kind for generated skill packages.'),
    origin: SkillManifestOriginSchema.describe('Origin metadata for the generated skill package.'),
    capabilities: z
      .array(SkillManifestCapabilitySchema)
      .min(1)
      .describe('Capability definitions generated for this skill package.'),
  })
  .describe('Generated skill manifest parsed from `plaited.skill.json`.')

/** @public */
export type GeneratedSkillManifest = z.infer<typeof GeneratedSkillManifestSchema>

export const SkillRegistryCapabilitySchema = SkillManifestCapabilitySchema.extend({
  address: z.string().min(1).describe('Namespaced capability address in `<skill-name>/<capability-id>` form.'),
}).describe('Capability registry entry enriched with a namespaced address.')

/** @public */
export type SkillRegistryCapability = z.infer<typeof SkillRegistryCapabilitySchema>

export const SkillRegistryEntrySchema = z
  .object({
    skill: SkillCatalogEntrySchema.describe('Skill metadata from `SKILL.md` frontmatter.'),
    origin: SkillManifestOriginSchema.describe('Generated skill origin metadata from manifest.'),
    capabilities: z.array(SkillRegistryCapabilitySchema).describe('Registry capabilities for this skill.'),
  })
  .describe('Capability registry entry for one skill package.')

/** @public */
export type SkillRegistryEntry = z.infer<typeof SkillRegistryEntrySchema>

export const SkillRegistryLoadResultSchema = z
  .object({
    registry: z.array(SkillRegistryEntrySchema).describe('Capability registry entries discovered under rootDir.'),
    errors: z
      .array(SkillCatalogErrorSchema)
      .describe('Validation or parsing errors for registry inputs that could not be loaded.'),
  })
  .describe('Capability registry load result for generated skill manifests.')

/** @public */
export type SkillRegistryLoadResult = z.infer<typeof SkillRegistryLoadResultSchema>

export const SkillsRegistryCliInputSchema = z
  .object({
    rootDir: z.string().min(1).describe('Workspace root directory used to discover skill manifests.'),
  })
  .describe('Input for `skills-registry`.')

/** @public */
export type SkillsRegistryCliInput = z.infer<typeof SkillsRegistryCliInputSchema>

export const SkillsRegistryCliOutputSchema = SkillRegistryLoadResultSchema.describe('Output for `skills-registry`.')

/** @public */
export type SkillsRegistryCliOutput = z.infer<typeof SkillsRegistryCliOutputSchema>

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

const SkillsCatalogModeInputSchema = SkillsCatalogCliInputSchema.extend({
  mode: z.literal('catalog').describe('Runs skill catalog discovery mode.'),
})

const SkillsRegistryModeInputSchema = SkillsRegistryCliInputSchema.extend({
  mode: z.literal('registry').describe('Runs generated capability registry discovery mode.'),
})

const SkillsValidateModeInputSchema = SkillsValidateCliInputSchema.extend({
  mode: z.literal('validate').describe('Runs single SKILL.md validation mode.'),
})

const SkillsLinksModeInputSchema = SkillsLinksCliInputSchema.extend({
  mode: z.literal('links').describe('Runs local instruction-link validation mode for one skill directory.'),
})

const SkillsInstructionsModeInputSchema = SkillsInstructionsCliInputSchema.extend({
  mode: z.literal('instructions').describe('Runs markdown instruction-body load mode for one skill directory.'),
})

const SkillsFrontmatterModeInputSchema = SkillsFrontmatterCliInputSchema.extend({
  mode: z.literal('frontmatter').describe('Runs parsed frontmatter load mode for one skill directory.'),
})

export const SkillsCliInputSchema = z
  .discriminatedUnion('mode', [
    SkillsCatalogModeInputSchema,
    SkillsRegistryModeInputSchema,
    SkillsValidateModeInputSchema,
    SkillsLinksModeInputSchema,
    SkillsInstructionsModeInputSchema,
    SkillsFrontmatterModeInputSchema,
  ])
  .describe('Input for `skills` with a mode-discriminated contract.')

/** @public */
export type SkillsCliInput = z.infer<typeof SkillsCliInputSchema>

export const SkillsCliOutputSchema = z
  .union([
    SkillsCatalogCliOutputSchema,
    SkillsRegistryCliOutputSchema,
    SkillsValidateCliOutputSchema,
    SkillsLinksCliOutputSchema,
    SkillsInstructionsCliOutputSchema,
    SkillsFrontmatterCliOutputSchema,
  ])
  .describe('Output for `skills`, matching the selected mode result schema.')

/** @public */
export type SkillsCliOutput = z.infer<typeof SkillsCliOutputSchema>

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
