export type ProgramRunnerAttemptStatus = 'prepared' | 'running' | 'succeeded' | 'failed'

export type ProgramRunnerAttempt = {
  attempt: number
  status: ProgramRunnerAttemptStatus
  worktreePath: string
  artifactDir: string
  allowedPaths: string[]
  workerCommand?: string[]
  validateCommand?: string[]
  startedAt?: string
  finishedAt?: string
  workerExitCode?: number
  validateExitCode?: number
  error?: string
}

export type ProgramRunnerRun = {
  lane: string
  programPath: string
  runDir: string
  workspaceRoot: string
  allowedPaths: string[]
  workerCommand?: string[]
  validateCommand?: string[]
  attempts: ProgramRunnerAttempt[]
}

export type ProgramRunnerRunInput = {
  programPath: string
  attempts?: number
  parallel?: number
  runDir?: string
  baseRef?: string
  workerCommand?: string[]
  validateCommand?: string[]
  defaultAllowedPaths?: string[]
}

export type ProgramRunnerStatusInput = {
  programPath: string
  runDir?: string
}
