import * as z from 'zod'

/**
 * Source classes for discovered factory modules.
 *
 * @public
 */
export const ModuleSourceClassSchema = z.enum(['default', 'deployment', 'generated'])

/** @public */
export type ModuleSourceClass = z.infer<typeof ModuleSourceClassSchema>

/**
 * Metadata for a loadable factory module.
 *
 * @public
 */
export const FactoryModuleCatalogEntrySchema = z.object({
  id: z.string().min(1),
  path: z.string().min(1),
  packageName: z.string().min(1).optional(),
  sourceClass: ModuleSourceClassSchema,
  factoryCount: z.number().int().nonnegative(),
})

/** @public */
export type FactoryModuleCatalogEntry = z.infer<typeof FactoryModuleCatalogEntrySchema>

/**
 * Signal schema for the discovered factory module catalog.
 *
 * @public
 */
export const FactoryModuleCatalogSchema = z.array(FactoryModuleCatalogEntrySchema)

/**
 * Event payload for explicit module loads.
 *
 * @public
 */
export const LoadFactoryModuleDetailSchema = z.object({
  path: z.string().min(1),
})

/** @public */
export type LoadFactoryModuleDetail = z.infer<typeof LoadFactoryModuleDetailSchema>
