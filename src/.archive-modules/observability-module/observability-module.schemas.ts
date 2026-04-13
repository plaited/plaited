import * as z from 'zod'

/**
 * Structured retained trace entry.
 *
 * @public
 */
export const ObservabilityTraceEntrySchema = z.object({
  kind: z.string().min(1),
  sourceEvent: z.string().min(1),
  summary: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
})

/** @public */
export type ObservabilityTraceEntry = z.infer<typeof ObservabilityTraceEntrySchema>

/**
 * Signal schema for retained trace entries.
 *
 * @public
 */
export const ObservabilityTraceLogSchema = z.array(ObservabilityTraceEntrySchema)
