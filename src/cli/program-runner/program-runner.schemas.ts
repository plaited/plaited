import * as z from 'zod'

export const ProgramRunnerAttemptStatusSchema = z.enum(['prepared', 'running', 'succeeded', 'failed'])
export type ProgramRunnerAttemptStatus = z.infer<typeof ProgramRunnerAttemptStatusSchema>

export const ProgramRunnerAttemptSchema = z.object({
  attempt: z.number().int().positive(),
  status: ProgramRunnerAttemptStatusSchema,
  worktreePath: z.string(),
  artifactDir: z.string(),
  allowedPaths: z.array(z.string()),
  workerCommand: z.array(z.string()).optional(),
  validateCommand: z.array(z.string()).optional(),
  startedAt: z.string().optional(),
  finishedAt: z.string().optional(),
  workerExitCode: z.number().int().optional(),
  validateExitCode: z.number().int().optional(),
  error: z.string().optional(),
})
export type ProgramRunnerAttempt = z.infer<typeof ProgramRunnerAttemptSchema>

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
export type ProgramRunnerRun = z.infer<typeof ProgramRunnerRunSchema>

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
export type ProgramRunnerRunInput = z.input<typeof ProgramRunnerRunInputSchema>

export const ProgramRunnerStatusInputSchema = z.object({
  programPath: z.string(),
  runDir: z.string().optional(),
})
export type ProgramRunnerStatusInput = z.input<typeof ProgramRunnerStatusInputSchema>
