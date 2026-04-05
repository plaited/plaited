/**
 * Zod schemas and types for the trial runner.
 *
 * @remarks
 * Schema-first approach — Zod schemas are the single source of truth,
 * TypeScript types derived via `z.infer<>`.
 *
 * `TrajectoryStepSchema` imported from `src/agent/agent.schemas.ts` (canonical source).
 *
 * @packageDocumentation
 */

import * as z from 'zod'
import { TrajectoryStepSchema } from '../agent/agent.schemas.ts'

export { TrajectoryStepSchema }
export type { TrajectoryStep } from '../agent/agent.schemas.ts'

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
export const PromptCaseSchema = z.object({
  /** Unique identifier for the test case */
  id: z.string(),
  /** Prompt text(s) — string for single turn, array for multi-turn */
  input: z.union([z.string(), z.array(z.string())]),
  /** Optional grader context hint */
  hint: z.string().optional(),
  /** Optional reference solution */
  reference: z.string().optional(),
  /** Optional metadata for categorization */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Optional per-case timeout override in milliseconds */
  timeout: z.number().optional(),
})

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
export const TimingSchema = z.object({
  /** Adapter-reported total duration in ms */
  total: z.number().optional(),
  /** Input tokens consumed */
  inputTokens: z.number().optional(),
  /** Output tokens generated */
  outputTokens: z.number().optional(),
})

/** Timing type */
export type Timing = z.infer<typeof TimingSchema>

// ============================================================================
// Capture Evidence
// ============================================================================

/**
 * Lightweight capture snippet for per-trial provenance.
 *
 * @remarks
 * Keeps JSONL output inspectable without embedding full provider-native logs.
 *
 * @public
 */
export const CaptureSnippetSchema = z.object({
  kind: z.enum(['message', 'thought', 'tool_call', 'event', 'stderr', 'stdout', 'usage']),
  text: z.string(),
})

/** Capture snippet type */
export type CaptureSnippet = z.infer<typeof CaptureSnippetSchema>

/**
 * Generic adapter-reported evidence about what was captured during a run.
 *
 * @remarks
 * This is intentionally model-agnostic. Adapters can summarize provider-native
 * streams here without promoting provider-specific event formats into `src/`.
 *
 * @public
 */
export const CaptureEvidenceSchema = z.object({
  /** Adapter or capture source identifier */
  source: z.string(),
  /** High-level capture format */
  format: z.enum(['response-only', 'chat-completion', 'jsonl-event-stream', 'mixed']),
  /** Count of provider-native events seen during the run */
  eventCount: z.number().int().min(0).optional(),
  /** Count of captured assistant/user-facing messages */
  messageCount: z.number().int().min(0).optional(),
  /** Count of captured reasoning/thought segments */
  thoughtCount: z.number().int().min(0).optional(),
  /** Count of captured tool calls or tool-like events */
  toolCallCount: z.number().int().min(0).optional(),
  /** Provider-native item/event labels observed during capture */
  itemTypes: z.array(z.string()).optional(),
  /** Short evidence snippets for inspection/debugging */
  snippets: z.array(CaptureSnippetSchema).optional(),
  /** Additional generic capture metadata */
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/** Capture evidence type */
export type CaptureEvidence = z.infer<typeof CaptureEvidenceSchema>

// ============================================================================
// Adapter
// ============================================================================

/**
 * Input passed to an adapter.
 *
 * @public
 */
export const AdapterInputSchema = z.object({
  /** Single or multi-turn prompt */
  prompt: z.union([z.string(), z.array(z.string())]),
  /** Working directory for the adapter */
  cwd: z.string().optional(),
  /** Optional scenario-specific system prompt override */
  systemPrompt: z.string().optional(),
})

/** Adapter input type */
export type AdapterInput = z.infer<typeof AdapterInputSchema>

/**
 * Result returned by an adapter.
 *
 * @public
 */
export const AdapterResultSchema = z.object({
  /** Final agent response text */
  output: z.string(),
  /** Optional structured trajectory */
  trajectory: z.array(TrajectoryStepSchema).optional(),
  /** Optional model-agnostic capture evidence */
  capture: CaptureEvidenceSchema.optional(),
  /** Optional timing from the adapter */
  timing: TimingSchema.optional(),
  /** Process exit code (null if signaled) */
  exitCode: z.number().nullable().optional(),
  /** Whether the adapter timed out */
  timedOut: z.boolean().optional(),
})

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
 *   tool call count, wall time. (0–1, higher = more efficient)
 *
 * @public
 */
export const GradingDimensionsSchema = z.object({
  /** Outcome correctness score */
  outcome: z.number().min(0).max(1).optional(),
  /** Process quality score */
  process: z.number().min(0).max(1).optional(),
  /** Efficiency score */
  efficiency: z.number().min(0).max(1).optional(),
})

/** Grading dimensions type */
export type GradingDimensions = z.infer<typeof GradingDimensionsSchema>

/**
 * Grader result schema.
 *
 * @public
 */
export const GraderResultSchema = z.object({
  /** Whether the output passes evaluation criteria */
  pass: z.boolean(),
  /** Numeric score from 0.0 to 1.0 */
  score: z.number().min(0).max(1),
  /** Optional explanation for the score */
  reasoning: z.string().optional(),
  /** Optional structured outcome data */
  outcome: z.record(z.string(), z.unknown()).optional(),
  /** Optional multi-dimensional scores */
  dimensions: GradingDimensionsSchema.optional(),
  /** Optional verifier confidence over the grader result */
  metaVerification: z
    .object({
      confidence: z.number().min(0).max(1),
      reasoning: z.string().optional(),
    })
    .optional(),
})

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
export const MetaVerificationSchema = z.object({
  confidence: z.number().min(0).max(1),
  reasoning: z.string().optional(),
})

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
  trajectory?: z.infer<typeof TrajectoryStepSchema>[]
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
export const TrialEntrySchema = z.object({
  /** Trial number (1-indexed) */
  trialNum: z.number(),
  /** Agent output for this trial */
  output: z.string(),
  /** Full trajectory for this trial */
  trajectory: z.array(TrajectoryStepSchema).optional(),
  /** Adapter-reported capture evidence for this trial */
  capture: CaptureEvidenceSchema.optional(),
  /** Runner-measured wall-clock duration in ms */
  duration: z.number(),
  /** Adapter-reported timing (token counts, adapter-measured duration) */
  timing: TimingSchema.optional(),
  /** Process exit code */
  exitCode: z.number().nullable().optional(),
  /** Whether the trial timed out */
  timedOut: z.boolean().optional(),
  /** Pass/fail (if grader provided) */
  pass: z.boolean().optional(),
  /** Numeric score (if grader provided) */
  score: z.number().optional(),
  /** Grader reasoning (if grader provided) */
  reasoning: z.string().optional(),
  /** Outcome data from grader */
  outcome: z.record(z.string(), z.unknown()).optional(),
  /** Multi-dimensional grading scores (if grader provides them) */
  dimensions: GradingDimensionsSchema.optional(),
  /** Optional verifier confidence over the grader result */
  metaVerification: MetaVerificationSchema.optional(),
})

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
export const TrialResultSchema = z.object({
  /** Test case identifier */
  id: z.string(),
  /** Original prompt input */
  input: z.union([z.string(), z.array(z.string())]),
  /** Grader context hint */
  hint: z.string().optional(),
  /** Number of trials (k) */
  k: z.number(),
  /** Simple pass rate: passes / k (with grader only) */
  passRate: z.number().optional(),
  /** pass@k: probability of at least one pass in k samples (with grader only) */
  passAtK: z.number().optional(),
  /** pass^k: probability of all k samples passing (with grader only) */
  passExpK: z.number().optional(),
  /** Individual trial results */
  trials: z.array(TrialEntrySchema),
  /** Metadata (from prompt case + runtime additions) */
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/** Trial result type */
export type TrialResult = z.infer<typeof TrialResultSchema>

// ============================================================================
// Trajectory Richness
// ============================================================================

/**
 * Trajectory richness level.
 *
 * @public
 */
export const TrajectoryRichnessSchema = z.enum(['full', 'minimal', 'messages-only'])

/** Trajectory richness type */
export type TrajectoryRichness = z.infer<typeof TrajectoryRichnessSchema>
