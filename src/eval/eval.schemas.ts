import * as z from 'zod'

import { SnapshotMessageSchema } from '../behavioral/behavioral.schemas.ts'
import {
  EVAL_CALIBRATE_FOCUSES,
  EVAL_CALIBRATE_REVIEW_LABELS,
  EVAL_CALIBRATE_SNAPSHOT_MODES,
  EVAL_COMMAND_OUTPUTS,
  EVAL_GRADER_TYPES,
  EVAL_GRADER_WHEN,
  EVAL_MODES,
  EVAL_TRIAL_STATUSES,
} from './eval.constants.ts'

const UnknownRecordSchema = z.record(z.string(), z.unknown())

export const EvalModeSchema = z
  .enum([EVAL_MODES.grade, EVAL_MODES.compare, EVAL_MODES.calibrate])
  .describe('Eval CLI execution mode.')

export type EvalMode = z.output<typeof EvalModeSchema>

export const EvalTrialStatusSchema = z
  .enum([
    EVAL_TRIAL_STATUSES.completed,
    EVAL_TRIAL_STATUSES.failed,
    EVAL_TRIAL_STATUSES.timed_out,
    EVAL_TRIAL_STATUSES.cancelled,
  ])
  .describe('Terminal trial status produced by the harness.')

export type EvalTrialStatus = z.output<typeof EvalTrialStatusSchema>

export const EvalTaskSchema = z
  .object({
    id: z.string().min(1).describe('Task identifier for the trial.'),
    prompt: z.string().min(1).describe('Prompt executed for the trial.'),
    metadata: UnknownRecordSchema.optional().describe('Optional task metadata from the harness.'),
  })
  .strict()
  .describe('Task payload for one evaluation trial.')

export type EvalTask = z.output<typeof EvalTaskSchema>

const EvalCompletedTrialResultSchema = z
  .object({
    status: z.literal(EVAL_TRIAL_STATUSES.completed),
    message: z.string().min(1).describe('Terminal assistant output for a completed trial.'),
    error: z.string().optional().describe('Optional runtime error text emitted alongside completion.'),
    metadata: UnknownRecordSchema.optional().describe('Optional trial-result metadata from the harness.'),
  })
  .strict()

const EvalFailedTrialResultSchema = z
  .object({
    status: z.enum([EVAL_TRIAL_STATUSES.failed, EVAL_TRIAL_STATUSES.timed_out, EVAL_TRIAL_STATUSES.cancelled]),
    message: z.string().optional().describe('Optional terminal assistant output for non-completed runs.'),
    error: z.string().optional().describe('Optional error text for non-completed runs.'),
    metadata: UnknownRecordSchema.optional().describe('Optional trial-result metadata from the harness.'),
  })
  .strict()

export const EvalTrialResultPayloadSchema = z
  .discriminatedUnion('status', [EvalCompletedTrialResultSchema, EvalFailedTrialResultSchema])
  .describe('Trial result envelope with explicit completion requirements.')

export type EvalTrialResultPayload = z.output<typeof EvalTrialResultPayloadSchema>

export const EvalTrialSchema = z
  .object({
    id: z.string().min(1).describe('Unique trial identifier.'),
    cwd: z.string().min(1).describe('Working directory used to execute grader commands for this trial.'),
    task: EvalTaskSchema.describe('Task payload executed for this trial.'),
    result: EvalTrialResultPayloadSchema.describe('Terminal trial result payload.'),
    snapshots: z.array(SnapshotMessageSchema).describe('Full retained snapshot stream for this trial.'),
    metadata: UnknownRecordSchema.optional().describe('Optional top-level trial metadata.'),
  })
  .strict()
  .describe('Canonical trial row used by plaited eval.')

export type EvalTrial = z.output<typeof EvalTrialSchema>

export const EvalProcessSummarySchema = z
  .object({
    snapshotCount: z.number().int().min(0).describe('Total number of snapshots retained on the trial.'),
    selectionCount: z.number().int().min(0).describe('Count of selection snapshots.'),
    runtimeErrorCount: z.number().int().min(0).describe('Count of runtime_error snapshots.'),
    feedbackErrorCount: z.number().int().min(0).describe('Count of feedback_error snapshots.'),
    deadlockCount: z.number().int().min(0).describe('Count of deadlock snapshots.'),
    workerFailureCount: z.number().int().min(0).describe('Count of worker snapshots whose response indicates failure.'),
    repeatedSelectionCount: z
      .number()
      .int()
      .min(0)
      .describe('Count of repeated same-type selections across adjacent selection snapshots.'),
    maxRepeatedSelectionTypeCount: z
      .number()
      .int()
      .min(0)
      .describe('Maximum consecutive selections with the same selected event type.'),
    runtimeErrorDetected: z.boolean().describe('True when runtime_error snapshots or worker failures are present.'),
    feedbackErrorDetected: z.boolean().describe('True when feedback_error snapshots are present.'),
    deadlockDetected: z.boolean().describe('True when deadlock snapshots are present.'),
    workerFailureDetected: z.boolean().describe('True when worker snapshot failures are present.'),
  })
  .strict()
  .describe('Deterministic process diagnostics derived from trial snapshots.')

export type EvalProcessSummary = z.output<typeof EvalProcessSummarySchema>

export const EvalGraderWhenSchema = z
  .enum([EVAL_GRADER_WHEN.always, EVAL_GRADER_WHEN.completed])
  .describe("Controls whether a grader runs for all trials or only status='completed' trials.")

export type EvalGraderWhen = z.output<typeof EvalGraderWhenSchema>

export const EvalCommandOutputSchema = z
  .enum([EVAL_COMMAND_OUTPUTS.exit_code, EVAL_COMMAND_OUTPUTS.grader_json])
  .describe('How command grader output should be interpreted.')

export type EvalCommandOutput = z.output<typeof EvalCommandOutputSchema>

export const EvalProcessGraderOptionsSchema = z
  .object({
    failOnRuntimeError: z.boolean().optional().default(true).describe('Fail when runtime errors are observed.'),
    failOnFeedbackError: z.boolean().optional().default(true).describe('Fail when feedback errors are observed.'),
    failOnDeadlock: z.boolean().optional().default(true).describe('Fail when deadlocks are observed.'),
    failOnWorkerFailure: z
      .boolean()
      .optional()
      .default(true)
      .describe('Fail when worker snapshot failures are observed.'),
    maxSelections: z.number().int().nonnegative().optional().describe('Fail when selectionCount exceeds this value.'),
    maxRepeatedSelectionType: z
      .number()
      .int()
      .nonnegative()
      .optional()
      .describe('Fail when maxRepeatedSelectionTypeCount exceeds this value.'),
  })
  .strict()
  .describe('Process grader threshold configuration.')

export type EvalProcessGraderOptions = z.output<typeof EvalProcessGraderOptionsSchema>

export const EvalCommandGraderOptionsSchema = z
  .object({
    command: z.array(z.string().min(1)).min(1).describe('Exact command argv executed in trial.cwd.'),
    output: EvalCommandOutputSchema.optional().default(EVAL_COMMAND_OUTPUTS.exit_code),
    timeoutMs: z.number().int().positive().optional().describe('Optional command timeout in milliseconds.'),
    maxOutputBytes: z.number().int().positive().optional().describe('Optional cap for captured stdout+stderr bytes.'),
  })
  .strict()
  .describe('Command grader execution options.')

export type EvalCommandGraderOptions = z.output<typeof EvalCommandGraderOptionsSchema>

export const EvalInlineGraderResultSchema = z
  .object({
    pass: z.boolean().describe('Inline pass/fail value.'),
    score: z.number().min(0).max(1).describe('Inline normalized score in [0, 1].'),
    reasoning: z.string().optional().describe('Optional grading rationale text.'),
    outcome: UnknownRecordSchema.optional().describe('Optional structured grader outcome payload.'),
    metadata: UnknownRecordSchema.optional().describe('Optional inline grader metadata.'),
  })
  .strict()
  .describe('Normalized grader result payload used by json graders and grader_json command output.')

export type EvalInlineGraderResult = z.output<typeof EvalInlineGraderResultSchema>

const EvalGraderBaseSchema = z
  .object({
    id: z.string().min(1).describe('Grader identifier.'),
    required: z.boolean().optional().default(true).describe('Whether this grader gates overall pass.'),
    weight: z.number().positive().optional().default(1).describe('Weight used for score aggregation.'),
    when: EvalGraderWhenSchema.optional().default(EVAL_GRADER_WHEN.always),
    metadata: UnknownRecordSchema.optional().describe('Optional grader metadata.'),
  })
  .strict()

export const EvalProcessGraderSchema = EvalGraderBaseSchema.extend({
  type: z.literal(EVAL_GRADER_TYPES.process),
  options: EvalProcessGraderOptionsSchema.optional().default({
    failOnRuntimeError: true,
    failOnFeedbackError: true,
    failOnDeadlock: true,
    failOnWorkerFailure: true,
  }),
})
  .strict()
  .describe('Built-in deterministic process grader.')

export type EvalProcessGrader = z.output<typeof EvalProcessGraderSchema>

export const EvalCommandGraderSchema = EvalGraderBaseSchema.extend({
  type: z.literal(EVAL_GRADER_TYPES.command),
  options: EvalCommandGraderOptionsSchema,
})
  .strict()
  .describe('External command grader executed inside trial.cwd.')

export type EvalCommandGrader = z.output<typeof EvalCommandGraderSchema>

export const EvalJsonGraderSchema = EvalGraderBaseSchema.extend({
  type: z.literal(EVAL_GRADER_TYPES.json),
  result: EvalInlineGraderResultSchema,
})
  .strict()
  .describe('Passive inline grader result provided by an upstream harness.')

export type EvalJsonGrader = z.output<typeof EvalJsonGraderSchema>

export const EvalGraderSchema = z
  .discriminatedUnion('type', [EvalProcessGraderSchema, EvalCommandGraderSchema, EvalJsonGraderSchema])
  .describe('Discriminated grader configuration union.')

export type EvalGrader = z.output<typeof EvalGraderSchema>

export const EvalGraderOutcomeSchema = z
  .record(z.string(), z.unknown())
  .describe('Optional structured outcome payload emitted by a grader run.')

export type EvalGraderOutcome = z.output<typeof EvalGraderOutcomeSchema>

export const EvalGraderResultSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum([EVAL_GRADER_TYPES.process, EVAL_GRADER_TYPES.command, EVAL_GRADER_TYPES.json]),
    required: z.boolean(),
    weight: z.number().positive(),
    when: EvalGraderWhenSchema,
    metadata: UnknownRecordSchema.optional(),
    skipped: z.boolean().describe('True when this grader was skipped by `when` policy.'),
    pass: z.boolean().nullable().describe('Null when skipped, boolean when executed.'),
    score: z.number().min(0).max(1).nullable().describe('Null when skipped, normalized score when executed.'),
    reasoning: z.string().optional(),
    outcome: EvalGraderOutcomeSchema.optional(),
  })
  .strict()
  .describe('Executed grader result row.')

export type EvalGraderResult = z.output<typeof EvalGraderResultSchema>

export const EvalTrialResultSchema = z
  .object({
    mode: z.literal(EVAL_MODES.grade),
    trial: EvalTrialSchema,
    process: EvalProcessSummarySchema,
    graderResults: z.array(EvalGraderResultSchema),
    pass: z.boolean(),
    score: z.number().min(0).max(1),
    reasoning: z.string().optional(),
  })
  .strict()
  .describe('Grade-mode output for one trial.')

export type EvalTrialResult = z.output<typeof EvalTrialResultSchema>

export const EvalRunBundleTaskSchema = z
  .object({
    taskId: z.string().min(1),
    metadata: UnknownRecordSchema.optional(),
    trials: z.array(EvalTrialResultSchema),
  })
  .strict()
  .describe('Task bundle row for compare mode.')

export type EvalRunBundleTask = z.output<typeof EvalRunBundleTaskSchema>

export const EvalRunBundleSchema = z
  .object({
    label: z.string().min(1),
    tasks: z.array(EvalRunBundleTaskSchema),
  })
  .strict()
  .describe('Eval run bundle used in compare mode.')

export type EvalRunBundle = z.output<typeof EvalRunBundleSchema>

export const EvalComparisonMetricsSchema = z
  .object({
    trialCount: z.number().int().nonnegative(),
    passCount: z.number().int().nonnegative(),
    passRate: z.number().min(0).max(1),
    avgScore: z.number().min(0).max(1),
    estimatedPassAtK: z.number().min(0).max(1).nullable().optional(),
    estimatedPassAllK: z.number().min(0).max(1).nullable().optional(),
  })
  .strict()
  .describe('Aggregate trial metrics for one run or one task row.')

export type EvalComparisonMetrics = z.output<typeof EvalComparisonMetricsSchema>

export const EvalComparisonWinnerSchema = z
  .enum(['baseline', 'challenger', 'tie', 'insufficient_data'])
  .describe('Winner for one comparable task row.')

export type EvalComparisonWinner = z.output<typeof EvalComparisonWinnerSchema>

export const EvalTaskComparisonRowSchema = z
  .object({
    taskId: z.string().min(1),
    baselineTrialCount: z.number().int().nonnegative(),
    challengerTrialCount: z.number().int().nonnegative(),
    comparable: z.boolean(),
    baseline: EvalComparisonMetricsSchema.nullable(),
    challenger: EvalComparisonMetricsSchema.nullable(),
    winner: EvalComparisonWinnerSchema,
  })
  .strict()
  .describe('Per-task baseline vs challenger comparison row.')

export type EvalTaskComparisonRow = z.output<typeof EvalTaskComparisonRowSchema>

export const EvalComparisonSummarySchema = z
  .object({
    baselineWins: z.number().int().nonnegative(),
    challengerWins: z.number().int().nonnegative(),
    ties: z.number().int().nonnegative(),
    insufficientData: z.number().int().nonnegative(),
    comparableTasks: z.number().int().nonnegative(),
    totalTasks: z.number().int().nonnegative(),
  })
  .strict()
  .describe('Top-level compare mode outcome counts.')

export type EvalComparisonSummary = z.output<typeof EvalComparisonSummarySchema>

export const EvalRunComparisonSchema = z
  .object({
    mode: z.literal(EVAL_MODES.compare),
    baseline: z
      .object({
        label: z.string().min(1),
        metrics: EvalComparisonMetricsSchema,
      })
      .strict(),
    challenger: z
      .object({
        label: z.string().min(1),
        metrics: EvalComparisonMetricsSchema,
      })
      .strict(),
    perTask: z.array(EvalTaskComparisonRowSchema),
    summary: EvalComparisonSummarySchema,
  })
  .strict()
  .describe('Compare-mode output for baseline/challenger eval bundles.')

export type EvalRunComparison = z.output<typeof EvalRunComparisonSchema>

export const EvalGradeInputSchema = z
  .object({
    mode: z.literal(EVAL_MODES.grade),
    trial: EvalTrialSchema,
    graders: z.array(EvalGraderSchema).min(1).describe('Ordered non-empty grader list for this trial.'),
  })
  .strict()
  .describe('Eval CLI input for grade mode (single trial per invocation).')

export type EvalGradeInput = z.output<typeof EvalGradeInputSchema>

export const EvalCompareInputSchema = z
  .object({
    mode: z.literal(EVAL_MODES.compare),
    baseline: EvalRunBundleSchema,
    challenger: EvalRunBundleSchema,
    k: z.number().int().positive().optional().describe('Optional sample count used to derive estimated pass metrics.'),
  })
  .strict()
  .describe('Eval CLI input for compare mode (baseline/challenger bundles).')

export type EvalCompareInput = z.output<typeof EvalCompareInputSchema>

export const EvalCalibrateFocusSchema = z
  .enum([EVAL_CALIBRATE_FOCUSES.required_failures, EVAL_CALIBRATE_FOCUSES.all_failures, EVAL_CALIBRATE_FOCUSES.all])
  .describe('Candidate focus strategy for calibrate mode.')

export type EvalCalibrateFocus = z.output<typeof EvalCalibrateFocusSchema>

export const EvalCalibrateSnapshotModeSchema = z
  .enum([EVAL_CALIBRATE_SNAPSHOT_MODES.diagnostic, EVAL_CALIBRATE_SNAPSHOT_MODES.all])
  .describe('Snapshot extraction strategy for calibrate samples.')

export type EvalCalibrateSnapshotMode = z.output<typeof EvalCalibrateSnapshotModeSchema>

export const EvalCalibrateInputSchema = z
  .object({
    mode: z.literal(EVAL_MODES.calibrate),
    bundle: EvalRunBundleSchema,
    focus: EvalCalibrateFocusSchema.optional().default(EVAL_CALIBRATE_FOCUSES.required_failures),
    sample: z.number().int().min(1).max(1000).optional().default(20),
    seed: z
      .union([z.string().min(1), z.number()])
      .optional()
      .describe('Optional deterministic sampling seed.'),
    graderId: z.string().min(1).optional().describe('Optional focused grader id filter.'),
    snapshotMode: EvalCalibrateSnapshotModeSchema.optional().default(EVAL_CALIBRATE_SNAPSHOT_MODES.diagnostic),
    maxSnapshotsPerSample: z.number().int().positive().optional().default(8),
  })
  .strict()
  .describe('Eval CLI input for calibrate mode.')

export type EvalCalibrateInput = z.output<typeof EvalCalibrateInputSchema>

const EvalTrialWithoutSnapshotsSchema = EvalTrialSchema.omit({ snapshots: true })
  .strict()
  .describe('Trial envelope without snapshot payload.')

export const EvalCalibrateReviewLabelSchema = z
  .enum([
    EVAL_CALIBRATE_REVIEW_LABELS.correct_accept,
    EVAL_CALIBRATE_REVIEW_LABELS.incorrect_accept,
    EVAL_CALIBRATE_REVIEW_LABELS.correct_reject,
    EVAL_CALIBRATE_REVIEW_LABELS.incorrect_reject,
    EVAL_CALIBRATE_REVIEW_LABELS.ambiguous,
    EVAL_CALIBRATE_REVIEW_LABELS.needs_human,
  ])
  .describe('Reviewer adjudication label.')

export type EvalCalibrateReviewLabel = z.output<typeof EvalCalibrateReviewLabelSchema>

export const EvalCalibrateSampleSourceSchema = z
  .object({
    bundleLabel: z.string().min(1),
    taskIndex: z.number().int().nonnegative(),
    trialIndex: z.number().int().nonnegative(),
    taskId: z.string().min(1),
    trialId: z.string().min(1),
  })
  .strict()
  .describe('Pointer to source trial location in the input bundle.')

export type EvalCalibrateSampleSource = z.output<typeof EvalCalibrateSampleSourceSchema>

export const EvalCalibrateFocusedGraderSummarySchema = z
  .object({
    graderId: z.string().min(1),
    executedPassCount: z.number().int().nonnegative(),
    executedFailCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    missingCount: z.number().int().nonnegative(),
  })
  .strict()
  .describe('Focused grader pass/fail/skipped summary for graderId mode.')

export type EvalCalibrateFocusedGraderSummary = z.output<typeof EvalCalibrateFocusedGraderSummarySchema>

export const EvalCalibrateGraderOutcomeSummarySchema = z
  .object({
    executedCount: z.number().int().nonnegative(),
    skippedCount: z.number().int().nonnegative(),
    requiredExecutedCount: z.number().int().nonnegative(),
    requiredPassCount: z.number().int().nonnegative(),
    requiredFailCount: z.number().int().nonnegative(),
    optionalExecutedCount: z.number().int().nonnegative(),
    optionalPassCount: z.number().int().nonnegative(),
    optionalFailCount: z.number().int().nonnegative(),
  })
  .strict()
  .describe('Required/optional and executed/skipped grader-outcome summary.')

export type EvalCalibrateGraderOutcomeSummary = z.output<typeof EvalCalibrateGraderOutcomeSummarySchema>

export const EvalCalibrateReviewPopulationSummarySchema = z
  .object({
    trialCount: z.number().int().nonnegative(),
    completedTrialCount: z.number().int().nonnegative(),
    nonCompletedTrialCount: z.number().int().nonnegative(),
    trialPassCount: z.number().int().nonnegative(),
    trialFailCount: z.number().int().nonnegative(),
    graderOutcomes: EvalCalibrateGraderOutcomeSummarySchema,
    focusedGrader: EvalCalibrateFocusedGraderSummarySchema.nullable(),
  })
  .strict()
  .describe('Trial/grader aggregate summary for a calibrate review population.')

export type EvalCalibrateReviewPopulationSummary = z.output<typeof EvalCalibrateReviewPopulationSummarySchema>

export const EvalCalibrateCandidateSummarySchema = z
  .object({
    focus: EvalCalibrateFocusSchema,
    candidateCount: z.number().int().nonnegative(),
    candidatePassCount: z.number().int().nonnegative(),
    candidateFailCount: z.number().int().nonnegative(),
    population: EvalCalibrateReviewPopulationSummarySchema,
  })
  .strict()
  .describe('Summary of the candidate pool before sampling.')

export type EvalCalibrateCandidateSummary = z.output<typeof EvalCalibrateCandidateSummarySchema>

export const EvalCalibrateSampleSummarySchema = z
  .object({
    requestedSample: z.number().int().positive(),
    actualSample: z.number().int().nonnegative(),
    sampledPassCount: z.number().int().nonnegative(),
    sampledFailCount: z.number().int().nonnegative(),
    population: EvalCalibrateReviewPopulationSummarySchema,
  })
  .strict()
  .describe('Summary of selected samples after deterministic sampling.')

export type EvalCalibrateSampleSummary = z.output<typeof EvalCalibrateSampleSummarySchema>

export const EvalCalibrateReviewProtocolSchema = z
  .object({
    labels: z.array(EvalCalibrateReviewLabelSchema).min(1),
    confidenceThreshold: z.number().min(0).max(1),
    guidance: z.array(z.string().min(1)).min(1),
    escalationRules: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .describe('Reusable reviewer protocol for grader calibration.')

export type EvalCalibrateReviewProtocol = z.output<typeof EvalCalibrateReviewProtocolSchema>

export const EvalCalibrateReviewResponseContractSchema = z
  .object({
    type: z.literal('object'),
    required: z.array(z.string().min(1)).min(1),
    properties: z.record(
      z.string(),
      z.object({
        type: z.string().min(1),
        enum: z.array(z.string()).optional(),
        minimum: z.number().optional(),
        maximum: z.number().optional(),
        minLength: z.number().int().optional(),
        description: z.string().min(1),
      }),
    ),
    constraints: z.array(z.string().min(1)).min(1),
  })
  .strict()
  .describe('Explicit reviewer response contract for calibrate-mode adjudication.')

export type EvalCalibrateReviewResponseContract = z.output<typeof EvalCalibrateReviewResponseContractSchema>

export const EvalCalibrateSampleSchema = z
  .object({
    source: EvalCalibrateSampleSourceSchema,
    trial: EvalTrialWithoutSnapshotsSchema,
    process: EvalProcessSummarySchema,
    graderResults: z.array(EvalGraderResultSchema),
    focusedGraderResult: EvalGraderResultSchema.nullable(),
    failedGraders: z.array(EvalGraderResultSchema),
    failedRequiredGraders: z.array(EvalGraderResultSchema),
    snapshots: z.array(SnapshotMessageSchema),
  })
  .strict()
  .describe('Calibrate-mode trial sample row with convenience grader fields.')

export type EvalCalibrateSample = z.output<typeof EvalCalibrateSampleSchema>

export const EvalCalibrateOutputSchema = z
  .object({
    mode: z.literal(EVAL_MODES.calibrate),
    focus: EvalCalibrateFocusSchema,
    sample: z.number().int().positive(),
    graderId: z.string().min(1).nullable(),
    snapshotMode: EvalCalibrateSnapshotModeSchema,
    maxSnapshotsPerSample: z.number().int().positive(),
    resolvedSeed: z.string().min(1),
    warnings: z.array(z.string()),
    reviewProtocol: EvalCalibrateReviewProtocolSchema,
    reviewResponseContract: EvalCalibrateReviewResponseContractSchema,
    bundleSummary: EvalCalibrateReviewPopulationSummarySchema,
    candidateSummary: EvalCalibrateCandidateSummarySchema,
    sampleSummary: EvalCalibrateSampleSummarySchema,
    samples: z.array(EvalCalibrateSampleSchema),
  })
  .strict()
  .describe('Calibrate-mode output payload.')

export type EvalCalibrateOutput = z.output<typeof EvalCalibrateOutputSchema>

export const EvalCliInputSchema = z
  .discriminatedUnion('mode', [EvalGradeInputSchema, EvalCompareInputSchema, EvalCalibrateInputSchema])
  .describe('Top-level plaited eval input schema.')

export type EvalCliInput = z.output<typeof EvalCliInputSchema>

export const EvalCliOutputSchema = z
  .discriminatedUnion('mode', [EvalTrialResultSchema, EvalRunComparisonSchema, EvalCalibrateOutputSchema])
  .describe('Top-level plaited eval output schema.')

export type EvalCliOutput = z.output<typeof EvalCliOutputSchema>
