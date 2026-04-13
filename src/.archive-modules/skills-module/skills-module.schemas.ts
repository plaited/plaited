import * as z from 'zod'

/**
 * Compact skill metadata exposed for discovery and selection.
 *
 * @public
 */
export const SkillCatalogEntrySchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  skillPath: z.string().min(1),
  skillDir: z.string().min(1),
  license: z.string().min(1).optional(),
  compatibility: z.string().min(1).optional(),
  allowedTools: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.string()).optional(),
  localLinks: z.object({
    present: z.array(z.string()),
    missing: z.array(z.string()),
  }),
})

/** @public */
export type SkillCatalogEntry = z.infer<typeof SkillCatalogEntrySchema>

/**
 * Full selected skill state retained after a selection event.
 *
 * @public
 */
export const SelectedSkillSchema = SkillCatalogEntrySchema.extend({
  body: z.string().min(1),
})

/** @public */
export type SelectedSkill = z.infer<typeof SelectedSkillSchema>

/**
 * Signal schema for the discovered skill catalog.
 *
 * @public
 */
export const SkillsCatalogSchema = z.array(SkillCatalogEntrySchema)

/**
 * Signal schema for the current selected skill.
 *
 * @public
 */
export const SkillsSelectedSignalSchema = SelectedSkillSchema.nullable()

/**
 * Event payload for selecting a skill.
 *
 * @public
 */
export const SelectSkillDetailSchema = z.object({
  name: z.string().min(1),
})

/** @public */
export type SelectSkillDetail = z.infer<typeof SelectSkillDetailSchema>
