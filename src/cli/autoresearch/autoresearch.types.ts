import type { Adapter, Grader, PromptCase, TrialResult } from '../eval/eval.schemas.ts'

/** @public */
export type AutoresearchTargetKind = 'skill' | 'factory' | 'prompt-pack'

/** @public */
export type AutoresearchTargetRef = {
  kind: AutoresearchTargetKind
  id: string
  path?: string
}

/** @public */
export type AutoresearchBudget = {
  maxCandidates?: number
  maxAttemptsPerCandidate?: number
  concurrency?: number
}

/** @public */
export type AutoresearchPromotion = {
  mode?: 'none' | 'candidate-only' | 'activate-overlay'
}

/** @public */
export type CandidateProposal = {
  id: string
  summary: string
  artifactPath: string
}

/** @public */
export type CandidateValidation = {
  pass: boolean
  reasoning: string
}

/** @public */
export type AutoresearchCandidateResult = CandidateProposal & {
  validation: 'passed' | 'failed'
  delta?: {
    passRate?: number
    passAtK?: number
    passExpK?: number
  }
}

/** @public */
export type AutoresearchOutput = {
  runId: string
  target: AutoresearchTargetRef
  baselineSummary: {
    passRate?: number
    passAtK?: number
    passExpK?: number
  }
  candidates: AutoresearchCandidateResult[]
  promotion: {
    decision: 'accepted' | 'rejected' | 'deferred'
    candidateId?: string
    reasoning: string
  }
}

/** @public */
export type RunAutoresearchConfig = {
  target: AutoresearchTargetRef
  adapter: Adapter
  prompts: PromptCase[]
  grader?: Grader
  outputDir?: string
  workspaceDir?: string
  baselineResultsPath?: string
  evidencePaths?: string[]
  budget?: AutoresearchBudget
  promotion?: AutoresearchPromotion
  progress?: boolean
}

/** @public */
export type AutoresearchTargetHandler = {
  kind: AutoresearchTargetKind
  collectObservations(args: {
    target: AutoresearchTargetRef
    evidencePaths: string[]
    baselineResults: TrialResult[]
  }): Promise<string[]>
  proposeCandidates(args: {
    target: AutoresearchTargetRef
    observations: string[]
    outputDir: string
    budget: AutoresearchBudget
  }): Promise<CandidateProposal[]>
  validateCandidate(args: { target: AutoresearchTargetRef; candidate: CandidateProposal }): Promise<CandidateValidation>
  applyCandidate(args: {
    target: AutoresearchTargetRef
    candidate: CandidateProposal
    mode: 'candidate-only' | 'activate-overlay'
  }): Promise<void>
}
