import * as z from 'zod'

/**
 * Source classes for discovered module modules.
 *
 * @public
 */
export const ModuleSourceClassSchema = z.enum(['default', 'deployment', 'generated'])

/** @public */
export type ModuleSourceClass = z.infer<typeof ModuleSourceClassSchema>

/**
 * Metadata for a loadable module module.
 *
 * @public
 */
export const ModuleModuleCatalogEntrySchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  packageName: z.string().min(1).optional(),
  sourceClass: ModuleSourceClassSchema,
  moduleCount: z.number().int().nonnegative(),
})

/** @public */
export type ModuleModuleCatalogEntry = z.infer<typeof ModuleModuleCatalogEntrySchema>

/**
 * Signal schema for the discovered module module catalog.
 *
 * @public
 */
export const ModuleModuleCatalogSchema = z.array(ModuleModuleCatalogEntrySchema)

/**
 * Event payload for explicit module loads.
 *
 * @public
 */
export const LoadModuleModuleDetailSchema = z.object({
  path: z.string().min(1),
})

/** @public */
export type LoadModuleModuleDetail = z.infer<typeof LoadModuleModuleDetailSchema>
