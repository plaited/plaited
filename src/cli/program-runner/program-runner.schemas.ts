import * as z from 'zod'

/**
 * Zod schema for the lifecycle state of a program-runner attempt.
 *
 * @public
 */
export const ProgramRunnerAttemptStatusSchema = z.enum(['prepared', 'running', 'succeeded', 'failed'])

/** @public */
export type ProgramRunnerAttemptStatus = z.infer<typeof ProgramRunnerAttemptStatusSchema>

/**
 * Zod schema for a single program-runner attempt record.
 *
 * @public
 */
export const ProgramRunnerAttemptSchema = z.object({
  attempt: z.number().int().positive(),
  status: ProgramRunnerAttemptStatusSchema,
  worktreePath: z.string(),
  artifactDir: z.string(),
  allowedPaths: z.array(z.string()),
  changedPaths: z.array(z.string()).optional(),
  outOfScopePaths: z.array(z.string()).optional(),
  workerCommand: z.array(z.string()).optional(),
  validateCommand: z.array(z.string()).optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  workerExitCode: z.number().int().optional(),
  validateExitCode: z.number().int().optional(),
  error: z.string().optional(),
})

/** @public */
export type ProgramRunnerAttempt = z.infer<typeof ProgramRunnerAttemptSchema>

/**
 * Zod schema for a persisted program-runner run.
 *
 * @public
 */
export const ProgramRunnerRunSchema = z.object({
  lane: z.string(),
  programPath: z.string(),
  runDir: z.string(),
  workspaceRoot: z.string(),
  allowedPaths: z.array(z.string()),
  workerCommand: z.array(z.string()).optional(),
  validateCommand: z.array(z.string()).optional(),
  attempts: z.array(ProgramRunnerAttemptSchema),
})

/** @public */
export type ProgramRunnerRun = z.infer<typeof ProgramRunnerRunSchema>

/**
 * Zod schema for starting a new program-runner run.
 *
 * @public
 */
export const ProgramRunnerRunInputSchema = z.object({
  programPath: z.string(),
  attempts: z.number().int().positive().default(1),
  parallel: z.number().int().positive().default(1),
  runDir: z.string().optional(),
  baseRef: z.string().default('HEAD'),
  workerCommand: z.array(z.string()).optional(),
  validateCommand: z.array(z.string()).optional(),
  defaultAllowedPaths: z.array(z.string()).default([]),
})

/** @public */
export type ProgramRunnerRunInput = z.input<typeof ProgramRunnerRunInputSchema>

/**
 * Zod schema for loading the status of an existing program-runner run.
 *
 * @public
 */
export const ProgramRunnerStatusInputSchema = z.object({
  programPath: z.string(),
  runDir: z.string().optional(),
})

/** @public */
export type ProgramRunnerStatusInput = z.input<typeof ProgramRunnerStatusInputSchema>
