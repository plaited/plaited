export {
  type LocalAdapterOptions,
  createLocalAdapter,
} from './improve/distillation-adapter.ts'

export {
  type ExperimentEntry,
  commitExperiment,
  discardExperiment,
  getBaseline,
  loadExperiments,
  logExperiment,
} from './improve/git-experiment.ts'

export {
  type TrainingCaptureReason,
  type TrainingCaptureAssessment,
  type TrainingAssessmentReason,
  type TrainingCandidateAssessment,
  type MetaVerification,
  type TrainingScore,
  type TrainingScoreInput,
  DecisionStepSchema,
  GradingDimensionsSchema,
  MetaVerificationSchema,
  TrainingCaptureReasonSchema,
  TrainingCaptureAssessmentSchema,
  TrainingAssessmentReasonSchema,
  TrainingCandidateAssessmentSchema,
  TrainingScoreInputSchema,
  TrainingScoreOutputSchema,
  TrainingScoreSchema,
} from './improve/training.schemas.ts'

export {
  type TrainingDataCandidate,
  type AssessTrainingCaptureOptions,
  type AssessTrainingCandidateOptions,
  assessTrainingCapture,
  assessTrainingCandidate,
  collectTrainingCandidates,
  computeTrainingWeight,
  scoreTrainingDimensions,
  trainingScoreCli,
  withStatisticalVerification,
} from './improve/training.ts'

export {
  DEFAULT_K,
  DEFAULT_TIMEOUT,
} from './improve/trial.constants.ts'

export {
  type Adapter,
  type AdapterInput,
  type AdapterResult,
  type Grader,
  type GraderResult,
  type GradingDimensions,
  type PromptCase,
  type Timing,
  type TrajectoryRichness,
  type TrajectoryStep,
  type TrialEntry,
  type TrialResult,
  AdapterInputSchema,
  AdapterResultSchema,
  GraderResultSchema,
  PromptCaseSchema,
  TimingSchema,
  TrajectoryRichnessSchema,
  TrajectoryStepSchema,
  TrialEntrySchema,
  TrialResultSchema,
} from './improve/trial.schemas.ts'

export {
  type TrialConfig,
  TrialInputSchema,
  TrialOutputSchema,
  calculatePassAtK,
  calculatePassExpK,
  runTrial,
  trialCli,
} from './improve/trial.ts'

export {
  type Verifier,
  loadAdapter,
  loadGrader,
  loadJsonl,
  persistTrialResults,
  withMetaVerification,
} from './improve/trial.utils.ts'
