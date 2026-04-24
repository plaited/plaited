/**
 * Snapshot-native Zod schemas and types for local Plaited eval.
 *
 * @remarks
 * Schema-first approach — Zod schemas are the single source of truth,
 * TypeScript types derived via `z.infer<>`.
 *
 * Local eval is intentionally grounded in behavioral snapshots and adjacent
 * runtime events/results from a concrete run.
 *
 * @packageDocumentation
 */

import * as z from 'zod'
import { BPEventSchema, SnapshotMessageSchema } from '../../behavioral/behavioral.schemas.ts'

// ============================================================================
// Prompt Case
// ============================================================================

/**
 * Prompt case schema for evaluation inputs.
 *
 * @remarks
 * Each line in a prompts.jsonl file should match this schema.
 * - Single turn: `input: "Hello"` — one prompt
 * - Multi-turn: `input: ["Hello", "Follow up"]` — sequential turns
 *
 * @public
 */
export const PromptCaseSchema = z
  .object({
    /** Unique identifier for the test case */
    id: z.string().describe('Unique prompt-case identifier.'),
    /** Prompt text(s) — string for single turn, array for multi-turn */
    input: z.union([z.string(), z.array(z.string())]).describe('Single-turn prompt or ordered multi-turn prompts.'),
    /** Optional grader context hint */
    hint: z.string().optional().describe('Optional grader hint or rubric context.'),
    /** Optional reference solution */
    reference: z.string().optional().describe('Optional reference answer for grader logic.'),
    /** Optional metadata for categorization */
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Optional per-case metadata for grouping/filtering.'),
    /** Optional per-case timeout override in milliseconds */
    timeout: z.number().optional().describe('Optional per-case timeout override in milliseconds.'),
  })
  .describe('Single prompt-case row loaded from prompts JSONL input.')

/** Prompt case type */
export type PromptCase = z.infer<typeof PromptCaseSchema>

// ============================================================================
// Timing
// ============================================================================

/**
 * Timing information from the adapter.
 *
 * @remarks
 * Adapter-reported timing. `total` is the adapter's own measurement
 * (may differ from the runner's wall-clock `duration` on TrialEntry).
 * Token counts are adapter-dependent — only present if the adapter exposes them.
 *
 * @public
 */
export const TimingSchema = z
  .object({
    /** Adapter-reported total duration in ms */
    total: z.number().optional().describe('Adapter-reported total duration in milliseconds.'),
    /** Input tokens consumed */
    inputTokens: z.number().optional().describe('Input token count, when exposed by the adapter/provider.'),
    /** Output tokens generated */
    outputTokens: z.number().optional().describe('Output token count, when exposed by the adapter/provider.'),
  })
  .describe('Adapter-reported timing and token telemetry for one run.')

/** Timing type */
export type Timing = z.infer<typeof TimingSchema>

// ============================================================================
// Snapshot-Native Trace
// ============================================================================

/**
 * Runtime event captured adjacent to behavioral snapshots.
 *
 * @public
 */
export const TraceEventSchema = BPEventSchema.extend({
  source: z.string().optional().describe('Optional runtime/source provenance label.'),
  timestamp: z.number().optional().describe('Optional event timestamp (epoch milliseconds).'),
}).describe('Runtime event row captured during the concrete run.')

/** Trace event type */
export type TraceEvent = z.infer<typeof TraceEventSchema>

/**
 * Runtime outputs/results captured during the concrete run.
 *
 * @public
 */
export const RuntimeOutputSchema = z
  .object({
    kind: z.string().describe('Runtime output/result channel label.'),
    status: z.enum(['ok', 'error']).optional().describe('Optional output status classification.'),
    type: z.string().optional().describe('Optional event or runtime output type label.'),
    detail: z.record(z.string(), z.unknown()).optional().describe('Optional structured runtime payload.'),
    error: z.string().optional().describe('Optional error text associated with this output.'),
    timestamp: z.number().optional().describe('Optional output timestamp (epoch milliseconds).'),
  })
  .describe('Runtime output/result row adjacent to behavioral snapshots.')

/** Runtime output type */
export type RuntimeOutput = z.infer<typeof RuntimeOutputSchema>

/**
 * Snapshot-native local trace for one concrete run.
 *
 * @remarks
 * This is the primary local process truth for eval grading/analysis.
 *
 * @public
 */
export const PlaitedTraceSchema = z
  .object({
    snapshots: z.array(SnapshotMessageSchema).optional().describe('Behavioral snapshot stream from the concrete run.'),
    selectedEvents: z
      .array(TraceEventSchema)
      .optional()
      .describe('Selected events observed or reconstructed during execution.'),
    emittedEvents: z.array(TraceEventSchema).optional().describe('Adjacent emitted runtime events, if available.'),
    runtimeOutputs: z.array(RuntimeOutputSchema).optional().describe('Adjacent runtime outputs/results/errors.'),
    metadata: z.record(z.string(), z.unknown()).optional().describe('Additional adapter-defined trace metadata.'),
  })
  .describe('Snapshot-native process trace captured for one local eval run.')

/** Snapshot-native trace type */
export type PlaitedTrace = z.infer<typeof PlaitedTraceSchema>

/**
 * Process trace coverage classification.
 *
 * @public
 */
export const ProcessTraceCoverageSchema = z
  .enum(['none', 'snapshots-only', 'events-only', 'snapshots-and-events'])
  .describe('Coverage level of runtime process trace evidence.')

/** Process trace coverage type */
export type ProcessTraceCoverage = z.infer<typeof ProcessTraceCoverageSchema>

/**
 * Snapshot-native process summary metrics for one trial.
 *
 * @remarks
 * Intended for JSONL inspectability and grader consumption without requiring
 * every grader to re-scan full trace payloads.
 *
 * @public
 */
export const TrialProcessSummarySchema = z
  .object({
    coverage: ProcessTraceCoverageSchema.describe('Coverage level for this trial trace.'),
    snapshotCount: z.number().int().min(0).describe('Total snapshot messages observed.'),
    selectionCount: z.number().int().min(0).describe('Selection snapshot count.'),
    selectedEventCount: z.number().int().min(0).describe('Selected event count from snapshots/events.'),
    emittedEventCount: z.number().int().min(0).describe('Emitted event count when available.'),
    deadlockCount: z.number().int().min(0).describe('Deadlock snapshot count.'),
    feedbackErrorCount: z.number().int().min(0).describe('Feedback error snapshot count.'),
    runtimeErrorCount: z.number().int().min(0).describe('Runtime error count including runner/runtime errors.'),
    runtimeOutputCount: z.number().int().min(0).describe('Runtime outputs/results row count.'),
    runtimeOutputErrorCount: z.number().int().min(0).describe('Runtime output rows classified as errors.'),
    blockedBidCount: z.number().int().min(0).describe('Count of bids with blocker attribution.'),
    interruptedBidCount: z.number().int().min(0).describe('Count of bids with interrupter attribution.'),
    repeatedSelectionCount: z.number().int().min(0).describe('Consecutive same-type selection repeats (loop signal).'),
    maxConsecutiveSelectionTypeCount: z
      .number()
      .int()
      .min(0)
      .describe('Maximum consecutive selections of the same event type.'),
    runnerErrorCount: z.number().int().min(0).describe('Runner-level execution error count.'),
    runnerTimeoutCount: z.number().int().min(0).describe('Runner timeout count.'),
    deadlockDetected: z.boolean().describe('True when any deadlock snapshot is present.'),
    feedbackErrorDetected: z.boolean().describe('True when any feedback error snapshot is present.'),
    runtimeErrorDetected: z.boolean().describe('True when runtime/runner errors are detected.'),
  })
  .describe('Snapshot-native process metrics summary for one trial.')

/** Trial process summary type */
export type TrialProcessSummary = z.infer<typeof TrialProcessSummarySchema>

// ============================================================================
// Adapter
// ============================================================================

/**
 * Input passed to an adapter.
 *
 * @public
 */
export const AdapterInputSchema = z
  .object({
    /** Single or multi-turn prompt */
    prompt: z.union([z.string(), z.array(z.string())]).describe('Single-turn prompt or ordered multi-turn prompts.'),
    /** Working directory for the adapter */
    cwd: z.string().optional().describe('Working directory for adapter execution.'),
    /** Optional scenario-specific system prompt override */
    systemPrompt: z.string().optional().describe('Optional system prompt override supplied by the runner.'),
  })
  .describe('Input contract passed to an eval adapter.')

/** Adapter input type */
export type AdapterInput = z.infer<typeof AdapterInputSchema>

/**
 * Result returned by an adapter.
 *
 * @public
 */
export const AdapterResultSchema = z
  .object({
    /** Final agent response text */
    output: z.string().describe('Final assistant output string for the trial.'),
    /** Optional snapshot-native trace */
    trace: PlaitedTraceSchema.optional().describe('Optional snapshot-native trace emitted by the adapter/runtime.'),
    /** Optional timing from the adapter */
    timing: TimingSchema.optional().describe('Optional adapter-reported timing/token telemetry.'),
    /** Process exit code (null if signaled) */
    exitCode: z
      .number()
      .nullable()
      .optional()
      .describe('Process exit code; null when signaled/terminated without code.'),
    /** Whether the adapter timed out */
    timedOut: z.boolean().optional().describe('Whether adapter execution exceeded the configured timeout.'),
  })
  .describe('Adapter execution result consumed by the eval runner.')

/** Adapter result type */
export type AdapterResult = z.infer<typeof AdapterResultSchema>

/**
 * Adapter function — runs a prompt against an agent and returns structured output.
 *
 * @remarks
 * TS module adapters export this as `adapt`. Executable adapters receive
 * `AdapterInput` on stdin and emit `AdapterResult` on stdout.
 *
 * @public
 */
export type Adapter = (input: AdapterInput) => Promise<AdapterResult>

// ============================================================================
// Grader
// ============================================================================

/**
 * Multi-dimensional grading scores.
 *
 * @remarks
 * Separates outcome correctness from process quality and efficiency.
 * All dimensions are optional — graders report only what they measure.
 *
 * - `outcome`: Did the agent produce the correct result? (0–1)
 * - `process`: Did the agent follow sound reasoning? BP snapshots
 *   provide ground truth for structural process quality. (0–1)
 * - `efficiency`: Resource usage relative to baseline — token count,
 *   runtime output volume, wall time. (0–1, higher = more efficient)
 *
 * @public
 */
export const GradingDimensionsSchema = z
  .object({
    /** Outcome correctness score */
    outcome: z.number().min(0).max(1).optional().describe('Outcome correctness score in [0, 1].'),
    /** Process quality score */
    process: z.number().min(0).max(1).optional().describe('Process quality score in [0, 1].'),
    /** Efficiency score */
    efficiency: z.number().min(0).max(1).optional().describe('Efficiency score in [0, 1].'),
  })
  .describe('Optional multi-dimensional grader scoring breakdown.')

/** Grading dimensions type */
export type GradingDimensions = z.infer<typeof GradingDimensionsSchema>

/**
 * Grader result schema.
 *
 * @public
 */
export const GraderResultSchema = z
  .object({
    /** Whether the output passes evaluation criteria */
    pass: z.boolean().describe('Pass/fail outcome from the grader.'),
    /** Numeric score from 0.0 to 1.0 */
    score: z.number().min(0).max(1).describe('Overall grader score in [0, 1].'),
    /** Optional explanation for the score */
    reasoning: z.string().optional().describe('Optional explanation for pass/score results.'),
    /** Optional structured outcome data */
    outcome: z.record(z.string(), z.unknown()).optional().describe('Optional structured grader output payload.'),
    /** Optional multi-dimensional scores */
    dimensions: GradingDimensionsSchema.optional().describe('Optional outcome/process/efficiency breakdown.'),
    /** Optional verifier confidence over the grader result */
    metaVerification: z
      .object({
        confidence: z.number().min(0).max(1).describe('Verifier confidence in grader correctness, in [0, 1].'),
        reasoning: z.string().optional().describe('Optional verifier rationale for confidence value.'),
      })
      .optional()
      .describe('Optional verifier assessment over grader output.'),
  })
  .describe('Grader output returned for a trial.')

/** Grader result type */
export type GraderResult = z.infer<typeof GraderResultSchema>

/**
 * Meta-verification result from a verifier function.
 *
 * @remarks
 * Keeps verifier confidence separate from the raw grader signal while still
 * allowing downstream selection/promotion tooling to reason about trust.
 *
 * @public
 */
export const MetaVerificationSchema = z
  .object({
    confidence: z.number().min(0).max(1).describe('Verifier confidence in grader correctness, in [0, 1].'),
    reasoning: z.string().optional().describe('Optional verifier rationale.'),
  })
  .describe('Verifier confidence payload retained on each trial row.')

/** Meta-verification type */
export type MetaVerification = z.infer<typeof MetaVerificationSchema>

/**
 * Grader function — scores agent output.
 *
 * @remarks
 * TS module graders export this as `grade`. Executable graders receive
 * grader input on stdin and emit `GraderResult` on stdout.
 *
 * @public
 */
export type Grader = (params: {
  input: string | string[]
  output: string
  hint?: string
  trace?: PlaitedTrace
  process?: TrialProcessSummary
  metadata?: Record<string, unknown>
  cwd?: string
}) => Promise<GraderResult>

// ============================================================================
// Trial Entry
// ============================================================================

/**
 * Single trial within a trial run.
 *
 * @public
 */
export const TrialEntrySchema = z
  .object({
    /** Trial number (1-indexed) */
    trialNum: z.number().describe('Trial index within prompt case (1-indexed).'),
    /** Agent output for this trial */
    output: z.string().describe('Final assistant output text for this trial.'),
    /** Snapshot-native local trace for this trial */
    trace: PlaitedTraceSchema.optional().describe('Optional snapshot-native trace captured for this trial.'),
    /** Snapshot-native process summary for this trial */
    process: TrialProcessSummarySchema.optional().describe('Optional process metrics derived from the trial trace.'),
    /** Runner-measured wall-clock duration in ms */
    duration: z.number().describe('Runner-measured wall-clock duration in milliseconds.'),
    /** Adapter-reported timing (token counts, adapter-measured duration) */
    timing: TimingSchema.optional().describe('Optional adapter-reported timing and token data.'),
    /** Process exit code */
    exitCode: z.number().nullable().optional().describe('Process exit code; null when signaled/terminated.'),
    /** Whether the trial timed out */
    timedOut: z.boolean().optional().describe('Whether trial execution hit timeout.'),
    /** Pass/fail (if grader provided) */
    pass: z.boolean().optional().describe('Grader pass/fail result when grading is enabled.'),
    /** Numeric score (if grader provided) */
    score: z.number().optional().describe('Grader score when grading is enabled.'),
    /** Grader reasoning (if grader provided) */
    reasoning: z.string().optional().describe('Optional grader explanation.'),
    /** Outcome data from grader */
    outcome: z.record(z.string(), z.unknown()).optional().describe('Optional structured outcome payload from grader.'),
    /** Multi-dimensional grading scores (if grader provides them) */
    dimensions: GradingDimensionsSchema.optional().describe('Optional outcome/process/efficiency scores.'),
    /** Optional verifier confidence over the grader result */
    metaVerification: MetaVerificationSchema.optional().describe('Optional verifier confidence for grading output.'),
  })
  .describe('One trial row for a prompt case execution.')

/** Trial entry type */
export type TrialEntry = z.infer<typeof TrialEntrySchema>

// ============================================================================
// Trial Result
// ============================================================================

/**
 * Trial result schema — unified output for all trial runs.
 *
 * @remarks
 * k=1 produces one trial entry. k>1 produces multiple entries with
 * pass@k/pass^k metrics when a grader is provided.
 *
 * @public
 */
export const TrialResultSchema = z
  .object({
    /** Test case identifier */
    id: z.string().describe('Prompt-case identifier from input prompts JSONL.'),
    /** Original prompt input */
    input: z.union([z.string(), z.array(z.string())]).describe('Original single-turn or multi-turn prompt input.'),
    /** Grader context hint */
    hint: z.string().optional().describe('Optional grader hint copied from the prompt case.'),
    /** Number of trials (k) */
    k: z.number().describe('Number of trials executed for this prompt case.'),
    /** Simple pass rate: passes / k (with grader only) */
    passRate: z.number().optional().describe('Passes / k, present when a grader is configured.'),
    /** pass@k: probability of at least one pass in k samples (with grader only) */
    passAtK: z.number().optional().describe('Estimated probability of at least one pass in k trials.'),
    /** pass^k: probability of all k samples passing (with grader only) */
    passExpK: z.number().optional().describe('Estimated probability of all k trials passing.'),
    /** Individual trial results */
    trials: z.array(TrialEntrySchema).describe('Per-trial execution rows for this prompt case.'),
    /** Metadata (from prompt case + runtime additions) */
    metadata: z
      .record(z.string(), z.unknown())
      .optional()
      .describe('Prompt metadata plus runtime-added metadata fields.'),
  })
  .describe('Unified per-prompt eval output row emitted by the trial runner.')

/** Trial result type */
export type TrialResult = z.infer<typeof TrialResultSchema>
