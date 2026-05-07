import * as z from 'zod'

const isSafeRelativeCommandPath = (command: string): boolean => {
  const normalized = command.replace(/\\/g, '/')
  if (normalized.startsWith('/')) return false
  if (/^[A-Za-z]:\//.test(normalized)) return false
  if (/[^\x21-\x7E]/.test(normalized)) return false
  if (/[\s"'`$&|;<>()[\]{}*!?]/.test(normalized)) return false
  return normalized.split('/').every((segment) => segment !== '..' && segment.length > 0)
}

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
const SkillCatalogErrorSchema = z
  .object({
    message: z.string().min(1).describe('Validation or parsing error for the referenced skill markdown file.'),
    path: z.string().min(1).describe('`/`-prefixed SKILL.md path relative to the catalog `rootDir`.'),
  })
  .describe('Validation error for a skill that could not be included in the catalog.')

/** @public */
export type SkillCatalogError = z.infer<typeof SkillCatalogErrorSchema>

const SkillResourceLinkSchema = z
  .object({
    value: z.string().min(1).describe('Normalized local link target path.'),
    text: z.string().min(1).describe('Display label resolved from link text or fallback target path.'),
  })
  .describe('Single local resource link referenced by skill instructions.')

const SkillCatalogLoadResultSchema = z
  .object({
    catalog: z.array(SkillCatalogEntrySchema).describe('Valid skills discovered under the requested root directory.'),
    errors: z
      .array(SkillCatalogErrorSchema)
      .describe('Invalid skills discovered during scan, with path-scoped validation errors.'),
  })
  .describe('Skill catalog discovery result with valid entries and structured validation errors.')

/** @public */
export type SkillCatalogLoadResult = z.infer<typeof SkillCatalogLoadResultSchema>

const SkillManifestOriginSourceSchema = z
  .object({
    type: z.string().min(1).describe('Source kind for skill provenance, such as `remote-mcp`.'),
    url: z.string().min(1).describe('Source URL used to generate the skill capability package.'),
  })
  .describe('Origin source metadata for a skill manifest.')

const SkillManifestGeneratedOriginSchema = z
  .object({
    kind: z.literal('generated').describe('Origin classification for generated skills.'),
    source: SkillManifestOriginSourceSchema.describe('Source metadata used for generation.'),
  })
  .describe('Generated skill origin block parsed from SKILL.md frontmatter metadata.')

const SkillManifestFirstPartyOriginSchema = z
  .object({
    kind: z.literal('first-party').describe('Origin classification for skills shipped with Plaited.'),
  })
  .describe('First-party skill origin block parsed from SKILL.md frontmatter metadata.')

const SkillManifestOriginSchema = z
  .union([SkillManifestGeneratedOriginSchema, SkillManifestFirstPartyOriginSchema])
  .describe('Skill origin metadata parsed from SKILL.md frontmatter.')

const SkillManifestCapabilityHandlerSchema = z
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
  .describe('CLI handler metadata for a capability.')

const SkillManifestCapabilitySourceSchema = z
  .object({
    type: z.string().min(1).describe('Capability source kind, such as `remote-mcp`.'),
    tool: z.string().min(1).optional().describe('Optional remote tool identifier tied to the capability.'),
  })
  .describe('Source attribution metadata for one capability.')

const SkillManifestCapabilityBaseSchema = z.object({
  id: z.string().min(1).describe('Capability identifier inside the skill package.'),
  lane: z.enum(['private', 'exchange']).describe('Runtime lane designation for this capability.'),
  phase: z
    .enum(['context', 'analysis', 'execution', 'validation', 'generation'])
    .describe('Execution phase where this capability is intended to run.'),
  audience: z.array(z.string().min(1)).min(1).describe('Allowed audience roles for this capability.'),
  actions: z.array(z.string().min(1)).min(1).describe('Action verbs the capability supports.'),
  sideEffects: z
    .enum(['none', 'read-only', 'workspace-write', 'network', 'service', 'external-state'])
    .describe('Declared side-effect profile for this capability.'),
  source: SkillManifestCapabilitySourceSchema.describe('Capability source attribution metadata.'),
})

const SkillManifestCliCapabilitySchema = SkillManifestCapabilityBaseSchema.extend({
  type: z.literal('cli').describe('CLI-backed capability type.'),
  handler: SkillManifestCapabilityHandlerSchema.describe('Capability handler runtime metadata.'),
})
  .strict()
  .describe('CLI-backed capability entry from a skill manifest.')

const SkillManifestWorkflowCapabilitySchema = SkillManifestCapabilityBaseSchema.extend({
  type: z.literal('workflow').describe('Instructional workflow capability type.'),
})
  .strict()
  .describe('Instructional workflow capability entry from a skill manifest.')

const SkillManifestCapabilitySchema = z
  .discriminatedUnion('type', [SkillManifestCliCapabilitySchema, SkillManifestWorkflowCapabilitySchema])
  .describe('Capability entry from a skill manifest.')

const SkillManifestSchema = z
  .object({
    kind: z.enum(['skill', 'generated-skill']).describe('Manifest kind for first-party and generated skill packages.'),
    origin: SkillManifestOriginSchema.describe('Origin metadata for the skill package.'),
    capabilities: z
      .array(SkillManifestCapabilitySchema)
      .min(1)
      .describe('Capability definitions for this skill package.'),
  })
  .describe('Skill manifest parsed from SKILL.md frontmatter metadata.')

const SkillRegistryCapabilityAddressSchema = z
  .object({
    address: z.string().min(1).describe('Namespaced capability address in `<skill-name>/<capability-id>` form.'),
  })
  .describe('Capability registry address metadata.')

const SkillRegistryCapabilitySchema = z
  .discriminatedUnion('type', [
    SkillManifestCliCapabilitySchema.extend(SkillRegistryCapabilityAddressSchema.shape),
    SkillManifestWorkflowCapabilitySchema.extend(SkillRegistryCapabilityAddressSchema.shape),
  ])
  .describe('Capability registry entry enriched with a namespaced address.')

export const SkillRegistryEntrySchema = z
  .object({
    skill: SkillCatalogEntrySchema.describe('Skill metadata from `SKILL.md` frontmatter.'),
    origin: SkillManifestOriginSchema.describe('Generated skill origin metadata from manifest.'),
    capabilities: z.array(SkillRegistryCapabilitySchema).describe('Registry capabilities for this skill.'),
  })
  .describe('Capability registry entry for one skill package.')

/** @public */
export type SkillRegistryEntry = z.infer<typeof SkillRegistryEntrySchema>

const SkillRegistryLoadResultSchema = z
  .object({
    registry: z.array(SkillRegistryEntrySchema).describe('Capability registry entries discovered under rootDir.'),
    errors: z
      .array(SkillCatalogErrorSchema)
      .describe('Validation or parsing errors for registry inputs that could not be loaded.'),
  })
  .describe('Capability registry load result for skill metadata in SKILL.md frontmatter.')

/** @public */
export type SkillRegistryLoadResult = z.infer<typeof SkillRegistryLoadResultSchema>

const SkillsRegistryCliInputSchema = z
  .object({
    rootDir: z.string().min(1).describe('Workspace root directory used to discover skill manifests.'),
  })
  .describe('Input for `skills-registry`.')

/** @public */
export type SkillsRegistryCliInput = z.infer<typeof SkillsRegistryCliInputSchema>

const SkillsRegistryCliOutputSchema = SkillRegistryLoadResultSchema.describe('Output for `skills-registry`.')

/** @public */
export type SkillsRegistryCliOutput = z.infer<typeof SkillsRegistryCliOutputSchema>

const SkillsCatalogCliInputSchema = z
  .object({
    rootDir: z.string().min(1).describe('Workspace root directory used to discover `skills/*` and `.agents/skills/*`.'),
  })
  .describe('Input for `skills-catalog`.')

/** @public */
export type SkillsCatalogCliInput = z.infer<typeof SkillsCatalogCliInputSchema>

const SkillsCatalogCliOutputSchema = SkillCatalogLoadResultSchema.describe('Output for `skills-catalog`.')

/** @public */
export type SkillsCatalogCliOutput = z.infer<typeof SkillsCatalogCliOutputSchema>

export const SkillFrontmatterResultSchema = z
  .record(z.string(), z.unknown())
  .describe('Parsed SKILL.md YAML frontmatter object.')

/** @public */
export type SkillFrontmatterResult = z.infer<typeof SkillFrontmatterResultSchema>

const SkillInstructionErrorSchema = z
  .object({
    skillPath: z.string().min(1).describe('Resolved path to the SKILL.md file that produced the error.'),
    message: z.string().min(1).describe('Validation, parsing, or file-resolution error message.'),
  })
  .describe('Structured error for a specific SKILL.md file.')

export const SkillInstructionErrorsSchema = z
  .array(SkillInstructionErrorSchema)
  .describe('Zero or more skill-scoped errors collected while loading or validating instructions.')

/** @public */
export type SkillInstructionErrors = z.infer<typeof SkillInstructionErrorsSchema>

const SkillsValidateCliInputSchema = z
  .object({
    skillPath: z.string().min(1).describe('Path to a specific SKILL.md file to validate.'),
  })
  .describe('Input for `skills-validate`.')

/** @public */
export type SkillsValidateCliInput = z.infer<typeof SkillsValidateCliInputSchema>

const SkillsValidateCliOutputSchema = z
  .object({
    ok: z.boolean().describe('True when the target SKILL.md passes frontmatter and directory-name validation.'),
    errors: z.array(z.string().min(1)).describe('Validation error messages. Empty when `ok` is true.'),
  })
  .describe('Output for `skills-validate`.')

/** @public */
export type SkillsValidateCliOutput = z.infer<typeof SkillsValidateCliOutputSchema>

const SkillsLinksCliInputSchema = z
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

const SkillResourceLinksJsonSchema = z
  .object({
    present: z.array(SkillResourceLinkSchema).describe('Resolved local links converted to JSON array output.'),
    missing: z.array(SkillResourceLinkSchema).describe('Missing local links converted to JSON array output.'),
  })
  .describe('JSON-serializable link validation result.')

/** @public */
export type SkillResourceLinksJson = z.infer<typeof SkillResourceLinksJsonSchema>

const SkillsLinksCliOutputSchema = z
  .object({
    links: SkillResourceLinksJsonSchema.describe('Present and missing local links referenced by the skill body.'),
    errors: SkillInstructionErrorsSchema.describe('Validation errors encountered while loading or parsing the skill.'),
  })
  .describe('Output for `skills-links`.')

/** @public */
export type SkillsLinksCliOutput = z.infer<typeof SkillsLinksCliOutputSchema>

const SkillsInstructionsCliInputSchema = z
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

const SkillsInstructionsCliOutputSchema = z
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

const SkillsFrontmatterCliInputSchema = z
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

const SkillsFrontmatterCliOutputSchema = z
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
  mode: z.literal('registry').describe('Runs skill capability registry discovery mode.'),
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
    metadata: z
      .object({
        plaited: z
          .lazy(() => SkillManifestSchema)
          .describe('Optional skill capability manifest consumed by `skills` registry mode.')
          .optional(),
      })
      .catchall(z.unknown())
      .describe('Optional arbitrary metadata object, including plaited skill metadata.')
      .optional(),
  })
  .describe('Validated YAML frontmatter contract for SKILL.md files.')

/** @public */
export type SkillFrontMatter = z.infer<typeof SkillFrontMatterSchema>
