import * as z from 'zod'

/**
 * Task phases used by the initial projection module.
 *
 * @public
 */
export const ProjectionPhaseSchema = z.enum(['planning', 'execution', 'verification'])

/** @public */
export type ProjectionPhase = z.infer<typeof ProjectionPhaseSchema>

/**
 * Compact projected context block.
 *
 * @public
 */
export const ProjectionBlockSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  body: z.string().min(1),
  sourceIds: z.array(z.string()),
})

/** @public */
export type ProjectionBlock = z.infer<typeof ProjectionBlockSchema>

/**
 * Signal schema for bounded context blocks.
 *
 * @public
 */
export const ProjectionBlocksSchema = z.array(ProjectionBlockSchema)
