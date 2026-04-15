/** @public */
export type AutoresearchTargetKind = 'module'

/** @public */
export type AutoresearchTargetRef = {
  kind: AutoresearchTargetKind
  id: string
  path?: string
  writableRoots?: string[]
}

/** @public */
export type AutoresearchEvaluation = {
  pass: boolean
  summary: string
  score?: number
  metrics?: Record<string, number>
}

/** @public */
export type AutoresearchExperiment = {
  iteration: number
  pass: boolean
  summary: string
  score?: number
  changedPaths: string[]
  artifactDir: string
}

/** @public */
export type AutoresearchLaneState = {
  runId: string
  laneDir: string
  programPath: string
  target: AutoresearchTargetRef
  initializedAt: string
  lastAcceptedIteration?: number
  experiments: AutoresearchExperiment[]
}

/** @public */
export type InitAutoresearchLaneConfig = {
  programPath: string
  target: AutoresearchTargetRef
  outputDir?: string
}

/** @public */
export type EvaluateAutoresearchLaneConfig = {
  laneDir: string
}

/** @public */
export type AutoresearchEvaluateOutput = {
  laneDir: string
  iteration: number
  programPath: string
  target: AutoresearchTargetRef
  pass: boolean
  summary: string
  score?: number
  changedPaths: string[]
  artifactDir: string
}

/** @public */
export type AutoresearchStatusConfig = {
  laneDir: string
}

/** @public */
export type AutoresearchAcceptConfig = {
  laneDir: string
}

/** @public */
export type AutoresearchRevertConfig = {
  laneDir: string
}
