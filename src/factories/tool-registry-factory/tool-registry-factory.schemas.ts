import * as z from 'zod'

/**
 * Capability classes tracked by the compact registry.
 *
 * @public
 */
export const CapabilityClassSchema = z.enum(['built-in', 'skill', 'module'])

/** @public */
export type CapabilityClass = z.infer<typeof CapabilityClassSchema>

/**
 * Compact capability record for metadata-first selection.
 *
 * @public
 */
export const CapabilityRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  capabilityClass: CapabilityClassSchema,
  sourceClass: z.string().min(1),
  path: z.string().min(1).optional(),
  tags: z.array(z.string()),
  authorityHints: z.array(z.string()),
})

/** @public */
export type CapabilityRecord = z.infer<typeof CapabilityRecordSchema>

/**
 * Signal schema for the compact capability registry.
 *
 * @public
 */
export const CapabilityRegistrySchema = z.array(CapabilityRecordSchema)
