import * as z from 'zod'

export const AutoresearchTargetKindSchema = z.enum(['module'])

export const AutoresearchTargetRefSchema = z.object({
  kind: AutoresearchTargetKindSchema,
  id: z.string().min(1),
  path: z.string().optional(),
  writableRoots: z.array(z.string().min(1)).optional(),
})

export const AutoresearchEvaluationSchema = z.object({
  pass: z.boolean(),
  summary: z.string().min(1),
  score: z.number().optional(),
  metrics: z.record(z.string(), z.number()).optional(),
})

export const AutoresearchExperimentSchema = z.object({
  iteration: z.number().int().positive(),
  pass: z.boolean(),
  summary: z.string().min(1),
  score: z.number().optional(),
  changedPaths: z.array(z.string()),
  artifactDir: z.string().min(1),
})

export const AutoresearchLaneStateSchema = z.object({
  runId: z.string().min(1),
  laneDir: z.string().min(1),
  programPath: z.string().min(1),
  target: AutoresearchTargetRefSchema,
  initializedAt: z.string().min(1),
  lastAcceptedIteration: z.number().int().positive().optional(),
  experiments: z.array(AutoresearchExperimentSchema),
})

export const AutoresearchInitInputSchema = z.object({
  programPath: z.string().min(1),
  target: AutoresearchTargetRefSchema,
  outputDir: z.string().optional(),
})

export const AutoresearchEvaluateInputSchema = z.object({
  laneDir: z.string().min(1),
})

export const AutoresearchStatusInputSchema = z.object({
  laneDir: z.string().min(1),
})

export const AutoresearchAcceptInputSchema = z.object({
  laneDir: z.string().min(1),
})

export const AutoresearchRevertInputSchema = z.object({
  laneDir: z.string().min(1),
})

export const AutoresearchEvaluateOutputSchema = z.object({
  laneDir: z.string().min(1),
  iteration: z.number().int().positive(),
  programPath: z.string().min(1),
  target: AutoresearchTargetRefSchema,
  pass: z.boolean(),
  summary: z.string().min(1),
  score: z.number().optional(),
  changedPaths: z.array(z.string()),
  artifactDir: z.string().min(1),
})

/** @public */
export type AutoresearchInitInput = z.infer<typeof AutoresearchInitInputSchema>

/** @public */
export type AutoresearchEvaluateInput = z.infer<typeof AutoresearchEvaluateInputSchema>

/** @public */
export type AutoresearchStatusInput = z.infer<typeof AutoresearchStatusInputSchema>

/** @public */
export type AutoresearchAcceptInput = z.infer<typeof AutoresearchAcceptInputSchema>

/** @public */
export type AutoresearchRevertInput = z.infer<typeof AutoresearchRevertInputSchema>
