import * as z from 'zod'
import { AutoresearchInitInputSchema, AutoresearchLaneStateSchema } from '../autoresearch/autoresearch.schemas.ts'

export const AutoresearchLaneInputSchema = AutoresearchInitInputSchema.extend({
  laneId: z.string().min(1).optional(),
})

export const AutoresearchOrchestratorInputSchema = z.object({
  lanes: z.array(AutoresearchLaneInputSchema).min(1),
  parallel: z.number().int().positive().default(1),
  baseRef: z.string().default('HEAD'),
  rootDir: z.string().optional(),
  adapterCommand: z.array(z.string().min(1)).optional(),
})

export const AutoresearchLaneResultSchema = z.object({
  laneId: z.string().min(1),
  status: z.enum(['succeeded', 'failed']),
  worktreePath: z.string().min(1),
  laneDir: z.string().min(1),
  exitCode: z.number().int(),
  adapterExitCode: z.number().int().optional(),
  result: AutoresearchLaneStateSchema.optional(),
  error: z.string().optional(),
})

export const AutoresearchOrchestratorOutputSchema = z.object({
  runId: z.string().min(1),
  baseRef: z.string().min(1),
  parallel: z.number().int().positive(),
  lanes: z.array(AutoresearchLaneResultSchema),
})

/** @public */
export type AutoresearchOrchestratorInput = z.infer<typeof AutoresearchOrchestratorInputSchema>
