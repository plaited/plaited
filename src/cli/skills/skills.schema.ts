import * as z from 'zod'

export const SkillDirectoryPathSchema = z.string().min(1)

/** @public */
export type SkillDirectoryPath = z.infer<typeof SkillDirectoryPathSchema>

export const SkillDirectoryPathsSchema = z.array(SkillDirectoryPathSchema)

/** @public */
export type SkillDirectoryPaths = z.infer<typeof SkillDirectoryPathsSchema>

/**
 * Compact skill metadata exposed for discovery and selection.
 *
 * @public
 */
export const SkillCatalogEntrySchema = z.object({
  name: z.string().min(1).describe('Skill name'),
  description: z.string().min(1).describe('Skill description'),
  path: z.string().min(1).describe('Path to skill'),
})

/** @public */
export type SkillCatalogEntry = z.infer<typeof SkillCatalogEntrySchema>

/**
 * Compact skill metadata exposed for discovery and selection.
 *
 * @public
 */
export const SkillCatalogErrorSchema = z.object({
  message: z.string().min(1),
  path: z.string().min(1).describe('Path to skill'),
})

/** @public */
export type SkillCatalogError = z.infer<typeof SkillCatalogErrorSchema>

export const SkillMetaSchema = z.object({
  license: z.string().min(1).optional(),
  compatibility: z.string().min(1).optional(),
  allowedTools: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

/** @public */
export type SkillMeta = z.infer<typeof SkillMetaSchema>

export const SkillInstructionSchema = z.object({
  body: z.string(),
})

/** @public */
export type SkillInstruction = z.infer<typeof SkillInstructionSchema>

export const SkillResourceLinkSchema = z.object({
  value: z.string().min(1),
  text: z.string().min(1),
})

/** @public */
export type SkillResourceLink = z.infer<typeof SkillResourceLinkSchema>

export const SkillResourceLinksSchema = z.object({
  present: z.set(SkillResourceLinkSchema),
  missing: z.set(SkillResourceLinkSchema),
})

/** @public */
export type SkillResourceLinks = z.infer<typeof SkillResourceLinksSchema>

export const SkillValidationStatusSchema = z.boolean()

/** @public */
export type SkillValidationStatus = z.infer<typeof SkillValidationStatusSchema>

export const SkillCatalogLoadResultSchema = z.object({
  catalog: z.array(SkillCatalogEntrySchema),
  errors: z.array(SkillCatalogErrorSchema),
})

/** @public */
export type SkillCatalogLoadResult = z.infer<typeof SkillCatalogLoadResultSchema>

export const SkillsCatalogCliInputSchema = z.object({
  rootDir: z.string().min(1),
})

/** @public */
export type SkillsCatalogCliInput = z.infer<typeof SkillsCatalogCliInputSchema>

export const SkillsCatalogCliOutputSchema = SkillCatalogLoadResultSchema

/** @public */
export type SkillsCatalogCliOutput = z.infer<typeof SkillsCatalogCliOutputSchema>

export const SkillInstructionsResultSchema = z.string()

/** @public */
export type SkillInstructionsResult = z.infer<typeof SkillInstructionsResultSchema>

export const SkillInstructionsLoadResultSchema = SkillInstructionsResultSchema.optional()

/** @public */
export type SkillInstructionsLoadResult = z.infer<typeof SkillInstructionsLoadResultSchema>

export const SkillFrontmatterResultSchema = z.record(z.string(), z.unknown())

/** @public */
export type SkillFrontmatterResult = z.infer<typeof SkillFrontmatterResultSchema>

export const SkillFrontmatterLoadResultSchema = SkillFrontmatterResultSchema.optional()

/** @public */
export type SkillFrontmatterLoadResult = z.infer<typeof SkillFrontmatterLoadResultSchema>

export const SkillInstructionErrorSchema = z.object({
  skillPath: z.string().min(1),
  message: z.string().min(1),
})

/** @public */
export type SkillInstructionError = z.infer<typeof SkillInstructionErrorSchema>

export const SkillInstructionErrorsSchema = z.array(SkillInstructionErrorSchema)

/** @public */
export type SkillInstructionErrors = z.infer<typeof SkillInstructionErrorsSchema>

export const SkillsValidateCliInputSchema = z.object({
  skillPath: z.string().min(1),
})

/** @public */
export type SkillsValidateCliInput = z.infer<typeof SkillsValidateCliInputSchema>

export const SkillsValidateCliOutputSchema = z.object({
  ok: z.boolean(),
  errors: z.array(z.string().min(1)),
})

/** @public */
export type SkillsValidateCliOutput = z.infer<typeof SkillsValidateCliOutputSchema>

export const SkillsLinksCliInputSchema = z.object({
  rootDir: z.string().min(1),
  path: z.string().min(1),
})

/** @public */
export type SkillsLinksCliInput = z.infer<typeof SkillsLinksCliInputSchema>

export const SkillResourceLinksJsonSchema = z.object({
  present: z.array(SkillResourceLinkSchema),
  missing: z.array(SkillResourceLinkSchema),
})

/** @public */
export type SkillResourceLinksJson = z.infer<typeof SkillResourceLinksJsonSchema>

export const SkillsLinksCliOutputSchema = z.object({
  links: SkillResourceLinksJsonSchema,
  errors: SkillInstructionErrorsSchema,
})

/** @public */
export type SkillsLinksCliOutput = z.infer<typeof SkillsLinksCliOutputSchema>

export const SkillsInstructionsCliInputSchema = z.object({
  rootDir: z.string().min(1),
  path: z.string().min(1),
})

/** @public */
export type SkillsInstructionsCliInput = z.infer<typeof SkillsInstructionsCliInputSchema>

export const SkillsInstructionsCliOutputSchema = z.object({
  body: z.string().nullable(),
  errors: SkillInstructionErrorsSchema,
})

/** @public */
export type SkillsInstructionsCliOutput = z.infer<typeof SkillsInstructionsCliOutputSchema>

export const SkillsFrontmatterCliInputSchema = z.object({
  rootDir: z.string().min(1),
  path: z.string().min(1),
})

/** @public */
export type SkillsFrontmatterCliInput = z.infer<typeof SkillsFrontmatterCliInputSchema>

export const SkillsFrontmatterCliOutputSchema = z.object({
  frontmatter: SkillFrontmatterResultSchema.nullable(),
  errors: SkillInstructionErrorsSchema,
})

/** @public */
export type SkillsFrontmatterCliOutput = z.infer<typeof SkillsFrontmatterCliOutputSchema>

export const SkillInstructionResourceLinksResultSchema = z.object({
  links: SkillResourceLinksSchema,
  errors: SkillInstructionErrorsSchema,
})

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
export const SkillFrontMatterSchema = z.object({
  name: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Name must contain only lowercase letters, numbers, and single hyphens'),
  description: z.string().min(1).max(1024),
  license: z.string().min(1).optional(),
  compatibility: z.string().min(1).max(500).optional(),
  'allowed-tools': z.string().min(1).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
})

/** @public */
export type SkillFrontMatter = z.infer<typeof SkillFrontMatterSchema>
