/**
 * Unified Zod schemas and types for the agent eval harness.
 *
 * @remarks
 * This module follows a schema-first approach where Zod schemas are the
 * single source of truth. TypeScript types are derived using `z.infer<>`.
 *
 * **Exports:**
 * - Harness schemas: PromptCaseSchema, GraderResultSchema, CaptureResultSchema, etc.
 * - JSON-RPC schemas: JsonRpcRequestSchema, JsonRpcResponseSchema, etc. (for headless adapter)
 * - All inferred types via `z.infer<>`
 *
 * **JSON Schema generation (Zod 4):**
 * ```typescript
 * import { z } from 'zod'
 * import { CaptureResultSchema } from '@plaited/agent-eval-harness/schemas'
 * const jsonSchema = z.toJSONSchema(CaptureResultSchema)
 * ```
 *
 * @packageDocumentation
 */

import { z } from 'zod'

// ============================================================================
// Session Types
// ============================================================================

/**
 * Session schema for session creation responses.
 */
export const SessionSchema = z.object({
  id: z.string(),
  _meta: z.record(z.string(), z.unknown()).nullish(),
})

/** Session object returned from session creation */
export type Session = z.infer<typeof SessionSchema>

// ============================================================================
// JSON-RPC 2.0 Schemas (for headless adapter)
// ============================================================================

/** JSON-RPC version literal */
const JsonRpcVersionSchema = z.literal('2.0')

/** Request/response identifier */
const RequestIdSchema = z.union([z.string(), z.number()])

/**
 * JSON-RPC 2.0 error object schema.
 *
 * @remarks
 * Standard error codes:
 * - `-32700`: Parse error
 * - `-32600`: Invalid request
 * - `-32601`: Method not found
 * - `-32602`: Invalid params
 * - `-32603`: Internal error
 */
export const JsonRpcErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
})

/** JSON-RPC 2.0 error object */
export type JsonRpcError = z.infer<typeof JsonRpcErrorSchema>

/** JSON-RPC 2.0 request schema */
export const JsonRpcRequestSchema = z.object({
  jsonrpc: JsonRpcVersionSchema,
  id: RequestIdSchema,
  method: z.string(),
  params: z.unknown().optional(),
})

/** JSON-RPC 2.0 request structure */
export type JsonRpcRequest<T = unknown> = Omit<z.infer<typeof JsonRpcRequestSchema>, 'params'> & {
  params?: T
}

/** JSON-RPC 2.0 notification schema (no id, no response expected) */
export const JsonRpcNotificationSchema = z.object({
  jsonrpc: JsonRpcVersionSchema,
  method: z.string(),
  params: z.unknown().optional(),
})

/** JSON-RPC 2.0 notification structure (no id, no response expected) */
export type JsonRpcNotification<T = unknown> = Omit<z.infer<typeof JsonRpcNotificationSchema>, 'params'> & {
  params?: T
}

/** JSON-RPC 2.0 success response schema */
export const JsonRpcSuccessResponseSchema = z.object({
  jsonrpc: JsonRpcVersionSchema,
  id: RequestIdSchema,
  result: z.unknown(),
})

/** JSON-RPC 2.0 success response */
export type JsonRpcSuccessResponse<T = unknown> = Omit<z.infer<typeof JsonRpcSuccessResponseSchema>, 'result'> & {
  result: T
}

/** JSON-RPC 2.0 error response schema */
export const JsonRpcErrorResponseSchema = z.object({
  jsonrpc: JsonRpcVersionSchema,
  id: z.union([RequestIdSchema, z.null()]),
  error: JsonRpcErrorSchema,
})

/** JSON-RPC 2.0 error response */
export type JsonRpcErrorResponse = z.infer<typeof JsonRpcErrorResponseSchema>

/** Union of all JSON-RPC response types */
export const JsonRpcResponseSchema = z.union([JsonRpcSuccessResponseSchema, JsonRpcErrorResponseSchema])

/** Union of all JSON-RPC response types */
export type JsonRpcResponse<T = unknown> = JsonRpcSuccessResponse<T> | JsonRpcErrorResponse

/**
 * Union of all JSON-RPC message types.
 *
 * @remarks
 * Use `safeParse` at transport boundaries for runtime validation.
 */
export const JsonRpcMessageSchema = z.union([JsonRpcRequestSchema, JsonRpcNotificationSchema, JsonRpcResponseSchema])

/** Union of all JSON-RPC message types */
export type JsonRpcMessage<T = unknown> = JsonRpcRequest<T> | JsonRpcNotification<T> | JsonRpcResponse<T>

// ============================================================================
// MCP Server Configuration Schemas
// ============================================================================

/** Environment variable configuration */
export const EnvVariableSchema = z.object({
  name: z.string(),
  value: z.string(),
})

/** HTTP header configuration */
export const HttpHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
})

/** MCP server stdio transport configuration */
export const McpServerStdioSchema = z.object({
  type: z.literal('stdio').optional(),
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()),
  env: z.array(EnvVariableSchema),
})

/** MCP server HTTP transport configuration */
export const McpServerHttpSchema = z.object({
  type: z.literal('http'),
  name: z.string(),
  url: z.string(),
  headers: z.array(HttpHeaderSchema),
})

/** MCP server configuration (stdio or HTTP) */
export const McpServerSchema = z.union([McpServerStdioSchema, McpServerHttpSchema])

/** MCP server configuration type */
export type McpServerConfig = z.infer<typeof McpServerSchema>

// ============================================================================
// Harness Input Schemas
// ============================================================================

/**
 * Prompt case schema for evaluation inputs.
 *
 * @remarks
 * Each line in a prompts.jsonl file should match this schema.
 * - Single turn: `input: "Hello"` - one prompt, one session
 * - Multi-turn: `input: ["Hello", "How are you?", "Goodbye"]` - sequential turns in one session
 */
export const PromptCaseSchema = z.object({
  /** Unique identifier for the test case */
  id: z.string(),
  /** Prompt text(s) - string for single turn, array for multi-turn conversation */
  input: z.union([z.string(), z.array(z.string())]),
  /** Optional grader context hint (not a strict expected match) */
  hint: z.string().optional(),
  /** Optional reference solution for validation */
  reference: z.string().optional(),
  /** Optional metadata for categorization and analysis */
  metadata: z.record(z.string(), z.unknown()).optional(),
  /** Optional per-case timeout override in milliseconds */
  timeout: z.number().optional(),
})

/** Prompt case type */
export type PromptCase = z.infer<typeof PromptCaseSchema>

// ============================================================================
// Grader Schemas
// ============================================================================

/**
 * Grader result schema.
 *
 * @remarks
 * Result returned by user-provided grader functions.
 * - `outcome`: Optional structured outcome data detected by the grader
 */
export const GraderResultSchema = z.object({
  /** Whether the output passes the evaluation criteria */
  pass: z.boolean(),
  /** Numeric score from 0.0 to 1.0 */
  score: z.number().min(0).max(1),
  /** Optional explanation for the score */
  reasoning: z.string().optional(),
  /** Optional outcome data (e.g., files created, tests passed) */
  outcome: z.record(z.string(), z.unknown()).optional(),
})

/** Grader result type */
export type GraderResult = z.infer<typeof GraderResultSchema>

/**
 * Grader function type.
 *
 * @remarks
 * User-provided graders implement this interface to score agent outputs.
 * - `input` is the original prompt (string or array for multi-turn)
 * - `hint` provides grader context (renamed from `expected`)
 * - `metadata` contains arbitrary key-value pairs from the original prompt JSONL
 * - `cwd` is the working directory path (optional, enables git-based outcome detection)
 */
export type Grader = (params: {
  input: string | string[]
  output: string
  hint?: string
  trajectory?: TrajectoryStep[]
  metadata?: Record<string, unknown>
  cwd?: string
}) => Promise<GraderResult>

// ============================================================================
// Trajectory Schemas
// ============================================================================

/** Tool input schema for extracting file paths and content */
export const ToolInputSchema = z
  .object({
    file_path: z.string().optional(),
    path: z.string().optional(),
    content: z.string().optional(),
    new_string: z.string().optional(),
  })
  .passthrough()

/** Tool input type */
export type ToolInput = z.infer<typeof ToolInputSchema>

/** Thought trajectory step */
export const ThoughtStepSchema = z.object({
  type: z.literal('thought'),
  content: z.string(),
  timestamp: z.number(),
  stepId: z.string().optional(),
})

/** Message trajectory step */
export const MessageStepSchema = z.object({
  type: z.literal('message'),
  content: z.string(),
  timestamp: z.number(),
  stepId: z.string().optional(),
})

/** Tool call trajectory step */
export const ToolCallStepSchema = z.object({
  type: z.literal('tool_call'),
  name: z.string(),
  status: z.string(),
  input: z.unknown().optional(),
  output: z.unknown().optional(),
  duration: z.number().optional(),
  timestamp: z.number(),
  stepId: z.string().optional(),
})

/** Plan trajectory step */
export const PlanStepSchema = z.object({
  type: z.literal('plan'),
  entries: z.array(z.unknown()),
  timestamp: z.number(),
  stepId: z.string().optional(),
})

/**
 * Trajectory step schema (discriminated union).
 *
 * @remarks
 * Represents a single step in the agent's execution trajectory.
 */
export const TrajectoryStepSchema = z.discriminatedUnion('type', [
  ThoughtStepSchema,
  MessageStepSchema,
  ToolCallStepSchema,
  PlanStepSchema,
])

/** Trajectory step type */
export type TrajectoryStep = z.infer<typeof TrajectoryStepSchema>

/** Indexed trajectory step with unique ID for correlation */
export type IndexedStep = TrajectoryStep & { stepId: string }

// ============================================================================
// Capture Result Schemas
// ============================================================================

/**
 * Timing information for a capture result.
 *
 * @remarks
 * Captures both absolute timestamps and derived durations for analysis:
 * - `sessionCreation`: Time to initialize session (agent startup overhead)
 * - `total`: End-to-end duration including all turns
 * - `firstResponse`: Latency to first agent output (optional)
 *
 * Token counts are adapter-dependent and only present if the adapter
 * exposes usage information (e.g., Claude Code includes them, others may not).
 *
 * @public
 */
export const TimingSchema = z.object({
  /** Epoch timestamp when capture started */
  start: z.number(),
  /** Epoch timestamp when capture ended */
  end: z.number(),
  /** Time to first response (ms from start) */
  firstResponse: z.number().optional(),
  /** Time to create session (ms) - measures agent initialization overhead */
  sessionCreation: z.number(),
  /** Total duration (end - start) in milliseconds */
  total: z.number(),
  /** Input tokens consumed (if available from headless adapter) */
  inputTokens: z.number().optional(),
  /** Output tokens generated (if available from headless adapter) */
  outputTokens: z.number().optional(),
})

/**
 * Timing information type inferred from TimingSchema.
 *
 * @public
 */
export type Timing = z.infer<typeof TimingSchema>

/**
 * Trajectory richness level indicating the depth of captured agent activity.
 *
 * @remarks
 * Different adapters provide varying levels of detail:
 * - `full`: Thoughts, tool calls, plans (e.g., Claude Code adapter)
 * - `minimal`: Basic output only (e.g., Droid adapter)
 * - `messages-only`: Messages without internal reasoning
 */
export const TrajectoryRichnessSchema = z.enum(['full', 'minimal', 'messages-only'])

/** Trajectory richness type */
export type TrajectoryRichness = z.infer<typeof TrajectoryRichnessSchema>

/**
 * Capture result schema.
 *
 * @remarks
 * Full trajectory output from the `capture` command.
 * - `input` can be string (single turn) or string[] (multi-turn)
 * - `hint` provides grader context (renamed from `expected`)
 * - `toolErrors` replaces misleading `status: 'passed'|'failed'`
 * - `outcome` is merged from grader result if grader returns outcome data
 * Real pass/fail determination comes from your grader.
 */
export const CaptureResultSchema = z.object({
  /** Test case identifier */
  id: z.string(),
  /** Original prompt input (string for single turn, array for multi-turn) */
  input: z.union([z.string(), z.array(z.string())]),
  /** Final agent output */
  output: z.string(),
  /** Grader context hint (renamed from expected) */
  hint: z.string().optional(),
  /** Full execution trajectory */
  trajectory: z.array(TrajectoryStepSchema),
  /** Metadata including category, agent info, trajectoryRichness, turnCount */
  metadata: z.record(z.string(), z.unknown()),
  /** Timing information */
  timing: TimingSchema,
  /** Whether any tool calls failed */
  toolErrors: z.boolean(),
  /** Error messages (if any) */
  errors: z.array(z.string()).optional(),
  /** Grader score (if grader was provided) */
  score: GraderResultSchema.optional(),
  /** Outcome data from grader (if grader provided and returned outcome) */
  outcome: z.record(z.string(), z.unknown()).optional(),
})

/** Capture result type */
export type CaptureResult = z.infer<typeof CaptureResultSchema>

// ============================================================================
// Summary Result Schemas
// ============================================================================

/**
 * Summary result schema.
 *
 * @remarks
 * Compact view derived from full capture results via the `summarize` command.
 */
export const SummaryResultSchema = z.object({
  /** Test case identifier */
  id: z.string(),
  /** Original prompt input */
  input: z.string(),
  /** Final agent output */
  output: z.string(),
  /** List of tool names called */
  toolCalls: z.array(z.string()),
  /** Duration in milliseconds */
  duration: z.number(),
})

/** Summary result type */
export type SummaryResult = z.infer<typeof SummaryResultSchema>

// ============================================================================
// Trial Result Schemas
// ============================================================================

/** Single trial within a trial run */
export const TrialEntrySchema = z.object({
  /** Trial number (1-indexed) */
  trialNum: z.number(),
  /** Agent output for this trial */
  output: z.string(),
  /** Full trajectory for this trial */
  trajectory: z.array(TrajectoryStepSchema),
  /** Duration in milliseconds */
  duration: z.number(),
  /** Pass/fail (if grader provided) */
  pass: z.boolean().optional(),
  /** Numeric score (if grader provided) */
  score: z.number().optional(),
  /** Grader reasoning (if grader provided) */
  reasoning: z.string().optional(),
  /** Outcome data from grader (if grader provided and returned outcome) */
  outcome: z.record(z.string(), z.unknown()).optional(),
})

/** Trial entry type */
export type TrialEntry = z.infer<typeof TrialEntrySchema>

/**
 * Trial result schema.
 *
 * @remarks
 * Output from the `trials` command for pass@k/pass^k analysis.
 * Metrics (passRate, passAtK, passExpK) are only present when a grader is provided.
 */
export const TrialResultSchema = z.object({
  /** Test case identifier */
  id: z.string(),
  /** Original prompt input (string for single turn, array for multi-turn) */
  input: z.union([z.string(), z.array(z.string())]),
  /** Grader context hint (renamed from expected) */
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
  /** Metadata including agent info, workspaceDir, and custom fields */
  metadata: z.record(z.string(), z.unknown()).optional(),
})

/** Trial result type */
export type TrialResult = z.infer<typeof TrialResultSchema>

// ============================================================================
// Calibration Schemas
// ============================================================================

/** Calibration sample for grader review */
export const CalibrationSampleSchema = z.object({
  /** Test case identifier */
  id: z.string(),
  /** Original prompt input (string for single turn, array for multi-turn) */
  input: z.union([z.string(), z.array(z.string())]),
  /** Agent output */
  output: z.string(),
  /** Grader context hint (renamed from expected) */
  hint: z.string().optional(),
  /** Original grader score */
  originalScore: GraderResultSchema,
  /** Re-scored result (if different grader provided) */
  rescoredResult: GraderResultSchema.optional(),
  /** Key trajectory snippets */
  trajectorySnippet: z.array(TrajectoryStepSchema),
})

/** Calibration sample type */
export type CalibrationSample = z.infer<typeof CalibrationSampleSchema>

// ============================================================================
// Balance Analysis Schemas
// ============================================================================

/** Category distribution in test set */
export const CategoryDistributionSchema = z.object({
  /** Category name */
  name: z.string(),
  /** Number of test cases */
  count: z.number(),
  /** Percentage of total */
  percentage: z.number(),
})

/** Category distribution type */
export type CategoryDistribution = z.infer<typeof CategoryDistributionSchema>

/** Balance analysis result */
export const BalanceAnalysisSchema = z.object({
  /** Total number of test cases */
  totalCases: z.number(),
  /** Distribution by category */
  categories: z.array(CategoryDistributionSchema),
  /** Categories that may need more test cases */
  underrepresented: z.array(z.string()),
  /** Suggested improvements */
  suggestions: z.array(z.string()),
})

/** Balance analysis type */
export type BalanceAnalysis = z.infer<typeof BalanceAnalysisSchema>

// ============================================================================
// Validation Reference Schemas
// ============================================================================

/** Validation result for a reference solution */
export const ValidationResultSchema = z.object({
  /** Test case identifier */
  id: z.string(),
  /** Reference solution provided */
  reference: z.string(),
  /** Whether reference passes the grader */
  passes: z.boolean(),
  /** Grader result */
  graderResult: GraderResultSchema,
})

/** Validation result type */
export type ValidationResult = z.infer<typeof ValidationResultSchema>

// ============================================================================
// Comparison Report Schemas
// ============================================================================

/**
 * Confidence interval schema as [lower, upper] bounds.
 *
 * @remarks
 * Used for bootstrap-computed confidence intervals when strategy=statistical.
 */
export const ConfidenceIntervalSchema = z.tuple([z.number(), z.number()])

/** Confidence interval type */
export type ConfidenceInterval = z.infer<typeof ConfidenceIntervalSchema>

/**
 * Score distribution histogram for quality analysis.
 *
 * @remarks
 * Buckets divide the 0-1 score range into 5 equal bins.
 */
export const ScoreDistributionSchema = z.object({
  '0.0-0.2': z.number(),
  '0.2-0.4': z.number(),
  '0.4-0.6': z.number(),
  '0.6-0.8': z.number(),
  '0.8-1.0': z.number(),
})

/** Score distribution type */
export type ScoreDistribution = z.infer<typeof ScoreDistributionSchema>

/**
 * Confidence intervals for quality metrics.
 */
export const QualityConfidenceIntervalsSchema = z.object({
  /** CI for avgScore */
  avgScore: ConfidenceIntervalSchema.optional(),
  /** CI for passRate */
  passRate: ConfidenceIntervalSchema.optional(),
})

/** Quality confidence intervals type */
export type QualityConfidenceIntervals = z.infer<typeof QualityConfidenceIntervalsSchema>

/**
 * Quality metrics for a single run in comparison.
 */
export const QualityMetricsSchema = z.object({
  /** Discriminator for run-level quality metrics */
  type: z.literal('run'),
  /** Mean grader score (0-1) */
  avgScore: z.number(),
  /** Percentage of pass=true results */
  passRate: z.number(),
  /** Count of passing results */
  passCount: z.number(),
  /** Count of failing results */
  failCount: z.number(),
  /** Score distribution histogram */
  scoreDistribution: ScoreDistributionSchema,
  /** Confidence intervals (only with strategy=statistical) */
  confidenceIntervals: QualityConfidenceIntervalsSchema.optional(),
})

/** Quality metrics type */
export type QualityMetrics = z.infer<typeof QualityMetricsSchema>

/**
 * Latency statistics for performance analysis.
 */
export const LatencyStatsSchema = z.object({
  /** 50th percentile (median) in milliseconds */
  p50: z.number(),
  /** 90th percentile in milliseconds */
  p90: z.number(),
  /** 99th percentile in milliseconds */
  p99: z.number(),
  /** Mean latency in milliseconds */
  mean: z.number(),
  /** Minimum latency in milliseconds */
  min: z.number(),
  /** Maximum latency in milliseconds */
  max: z.number(),
})

/** Latency stats type */
export type LatencyStats = z.infer<typeof LatencyStatsSchema>

/**
 * Confidence intervals for performance metrics.
 */
export const PerformanceConfidenceIntervalsSchema = z.object({
  /** CI for latency mean */
  latencyMean: ConfidenceIntervalSchema.optional(),
})

/** Performance confidence intervals type */
export type PerformanceConfidenceIntervals = z.infer<typeof PerformanceConfidenceIntervalsSchema>

/**
 * Performance metrics for a single run in comparison.
 */
export const PerformanceMetricsSchema = z.object({
  /** End-to-end latency statistics */
  latency: LatencyStatsSchema,
  /** Time to first response statistics (optional, not all adapters support) */
  firstResponse: LatencyStatsSchema.optional(),
  /** Sum of all run durations in milliseconds */
  totalDuration: z.number(),
  /** Confidence intervals (only with strategy=statistical) */
  confidenceIntervals: PerformanceConfidenceIntervalsSchema.optional(),
})

/** Performance metrics type */
export type PerformanceMetrics = z.infer<typeof PerformanceMetricsSchema>

/**
 * Reliability metrics for a single run in comparison.
 */
export const ReliabilityMetricsSchema = z.object({
  /** Discriminator for run-based reliability metrics */
  type: z.literal('run'),
  /** Count of runs with toolErrors=true */
  toolErrors: z.number(),
  /** Percentage of runs with tool errors */
  toolErrorRate: z.number(),
  /** Count of runs that hit timeout */
  timeouts: z.number(),
  /** Percentage of runs that hit timeout */
  timeoutRate: z.number(),
  /** Percentage of runs that completed successfully */
  completionRate: z.number(),
})

/** Reliability metrics type */
export type ReliabilityMetrics = z.infer<typeof ReliabilityMetricsSchema>

/**
 * Trajectory info for a single run in comparison.
 */
export const TrajectoryInfoSchema = z.object({
  /** Trajectory richness level */
  richness: TrajectoryRichnessSchema,
  /** Average trajectory steps per run */
  avgStepCount: z.number(),
})

/** Trajectory info type */
export type TrajectoryInfo = z.infer<typeof TrajectoryInfoSchema>

/**
 * Per-prompt comparison entry for head-to-head drill-down.
 */
export const PromptComparisonSchema = z.object({
  /** Prompt identifier */
  id: z.string(),
  /** Run label of the winner, or null if tie */
  winner: z.string().nullable(),
  /** Scores by run label */
  scores: z.record(z.string(), z.number()),
  /** Latencies by run label in milliseconds */
  latencies: z.record(z.string(), z.number()),
  /** Whether each run had errors */
  hadErrors: z.record(z.string(), z.boolean()),
})

/** Prompt comparison type */
export type PromptComparison = z.infer<typeof PromptComparisonSchema>

/**
 * Pairwise win/loss/tie statistics between two runs.
 */
export const PairwiseComparisonSchema = z.object({
  /** First run label */
  runA: z.string(),
  /** Second run label */
  runB: z.string(),
  /** Number of prompts where A won */
  aWins: z.number(),
  /** Number of prompts where B won */
  bWins: z.number(),
  /** Number of prompts where A and B tied */
  ties: z.number(),
})

/** Pairwise comparison type */
export type PairwiseComparison = z.infer<typeof PairwiseComparisonSchema>

/**
 * Head-to-head comparison section.
 */
export const HeadToHeadSchema = z.object({
  /** Per-prompt breakdown for drill-down */
  prompts: z.array(PromptComparisonSchema),
  /** Pairwise win rates between runs */
  pairwise: z.array(PairwiseComparisonSchema),
})

/** Head-to-head type */
export type HeadToHead = z.infer<typeof HeadToHeadSchema>

/**
 * Metadata for the comparison report.
 */
export const ComparisonMetaSchema = z.object({
  /** ISO timestamp when report was generated */
  generatedAt: z.string(),
  /** Run labels included in comparison */
  runs: z.array(z.string()),
  /** Total prompts compared */
  promptCount: z.number(),
  /** Prompts where all runs completed */
  promptsWithAllRuns: z.number(),
})

/** Comparison meta type */
export type ComparisonMeta = z.infer<typeof ComparisonMetaSchema>

/**
 * Holistic comparison report schema.
 *
 * @remarks
 * Aggregates comparison output across all dimensions:
 * - Quality: pass rates, scores, distributions
 * - Performance: latency percentiles
 * - Reliability: error rates, completion rates
 * - Head-to-head: per-prompt winners, pairwise stats
 *
 * Note: Tool usage analysis is NOT included because adapter formats vary.
 * Different adapters provide different `trajectoryRichness` levels and
 * the `tool_call.name` field often contains tool use IDs rather than
 * human-readable names.
 */
export const ComparisonReportSchema = z.object({
  /** Report metadata */
  meta: ComparisonMetaSchema,
  /** Quality metrics by run label */
  quality: z.record(z.string(), QualityMetricsSchema),
  /** Performance metrics by run label */
  performance: z.record(z.string(), PerformanceMetricsSchema),
  /** Reliability metrics by run label */
  reliability: z.record(z.string(), ReliabilityMetricsSchema),
  /** Trajectory info by run label */
  trajectoryInfo: z.record(z.string(), TrajectoryInfoSchema),
  /** Head-to-head comparison details */
  headToHead: HeadToHeadSchema,
})

/** Comparison report type */
export type ComparisonReport = z.infer<typeof ComparisonReportSchema>

// ============================================================================
// Trials Comparison Report Schemas
// ============================================================================

/**
 * Confidence intervals for trials capability metrics.
 */
export const TrialsCapabilityConfidenceIntervalsSchema = z.object({
  /** CI for avgPassAtK */
  avgPassAtK: ConfidenceIntervalSchema.optional(),
})

/** Trials capability confidence intervals type */
export type TrialsCapabilityConfidenceIntervals = z.infer<typeof TrialsCapabilityConfidenceIntervalsSchema>

/**
 * Capability metrics for trials comparison (passAtK-based).
 *
 * @remarks
 * Measures whether the agent CAN solve the task (at least once in K tries).
 * Higher passAtK means the agent has the capability to solve the task.
 */
export const TrialsCapabilityMetricsSchema = z.object({
  /** Average passAtK across all prompts */
  avgPassAtK: z.number(),
  /** Median passAtK */
  medianPassAtK: z.number(),
  /** 25th percentile passAtK */
  p25PassAtK: z.number(),
  /** 75th percentile passAtK */
  p75PassAtK: z.number(),
  /** Confidence intervals (only with strategy=statistical) */
  confidenceIntervals: TrialsCapabilityConfidenceIntervalsSchema.optional(),
})

/** Trials capability metrics type */
export type TrialsCapabilityMetrics = z.infer<typeof TrialsCapabilityMetricsSchema>

/**
 * Confidence intervals for trials reliability metrics.
 */
export const TrialsReliabilityConfidenceIntervalsSchema = z.object({
  /** CI for avgPassExpK */
  avgPassExpK: ConfidenceIntervalSchema.optional(),
})

/** Trials reliability confidence intervals type */
export type TrialsReliabilityConfidenceIntervals = z.infer<typeof TrialsReliabilityConfidenceIntervalsSchema>

/**
 * Reliability metrics for trials comparison (passExpK-based).
 *
 * @remarks
 * Measures whether the agent CONSISTENTLY solves the task (all K tries).
 * Higher passExpK means the agent reliably solves the task every time.
 */
export const TrialsReliabilityMetricsSchema = z.object({
  /** Discriminator for trial-based reliability metrics */
  type: z.literal('trial'),
  /** Average passExpK across all prompts */
  avgPassExpK: z.number(),
  /** Median passExpK */
  medianPassExpK: z.number(),
  /** 25th percentile passExpK */
  p25PassExpK: z.number(),
  /** 75th percentile passExpK */
  p75PassExpK: z.number(),
  /** Confidence intervals (only with strategy=statistical) */
  confidenceIntervals: TrialsReliabilityConfidenceIntervalsSchema.optional(),
})

/** Trials reliability metrics type */
export type TrialsReliabilityMetrics = z.infer<typeof TrialsReliabilityMetricsSchema>

/**
 * Flakiness metrics for trials comparison.
 *
 * @remarks
 * Flakiness = passAtK - passExpK, measuring the gap between capability and reliability.
 * A high flakiness score means the agent can sometimes solve the task but not consistently.
 */
export const TrialsFlakinessMetricsSchema = z.object({
  /** Average flakiness across all prompts */
  avgFlakiness: z.number(),
  /** Median flakiness */
  medianFlakiness: z.number(),
  /** Number of prompts with non-zero flakiness */
  flakyPromptCount: z.number(),
  /** Top flaky prompts by flakiness score */
  topFlakyPrompts: z.array(
    z.object({
      /** Prompt identifier */
      id: z.string(),
      /** Flakiness score (passAtK - passExpK) */
      flakiness: z.number(),
    }),
  ),
})

/** Trials flakiness metrics type */
export type TrialsFlakinessMetrics = z.infer<typeof TrialsFlakinessMetricsSchema>

/**
 * Confidence intervals for trials quality metrics.
 */
export const TrialsQualityConfidenceIntervalsSchema = z.object({
  /** CI for avgScore */
  avgScore: ConfidenceIntervalSchema.optional(),
})

/** Trials quality confidence intervals type */
export type TrialsQualityConfidenceIntervals = z.infer<typeof TrialsQualityConfidenceIntervalsSchema>

/**
 * Quality metrics for trials comparison (score-based).
 *
 * @remarks
 * Aggregates grader scores across all trials for each prompt.
 * Only present when a grader was used during trials capture.
 */
export const TrialsQualityMetricsSchema = z.object({
  /** Discriminator for trial-level quality metrics */
  type: z.literal('trial'),
  /** Average score across all trials */
  avgScore: z.number(),
  /** Median score */
  medianScore: z.number(),
  /** 25th percentile score */
  p25Score: z.number(),
  /** 75th percentile score */
  p75Score: z.number(),
  /** Confidence intervals (only with strategy=statistical) */
  confidenceIntervals: TrialsQualityConfidenceIntervalsSchema.optional(),
})

/** Trials quality metrics type */
export type TrialsQualityMetrics = z.infer<typeof TrialsQualityMetricsSchema>

/**
 * Confidence intervals for trials performance metrics.
 */
export const TrialsPerformanceConfidenceIntervalsSchema = z.object({
  /** CI for latency mean */
  latencyMean: ConfidenceIntervalSchema.optional(),
})

/** Trials performance confidence intervals type */
export type TrialsPerformanceConfidenceIntervals = z.infer<typeof TrialsPerformanceConfidenceIntervalsSchema>

/**
 * Performance metrics for trials comparison (latency-based).
 *
 * @remarks
 * Aggregates trial durations across all prompts.
 * Always present since TrialEntry.duration is required.
 */
export const TrialsPerformanceMetricsSchema = z.object({
  /** End-to-end latency statistics across all trials */
  latency: LatencyStatsSchema,
  /** Sum of all trial durations in milliseconds */
  totalDuration: z.number(),
  /** Confidence intervals (only with strategy=statistical) */
  confidenceIntervals: TrialsPerformanceConfidenceIntervalsSchema.optional(),
})

/** Trials performance metrics type */
export type TrialsPerformanceMetrics = z.infer<typeof TrialsPerformanceMetricsSchema>

/**
 * Per-prompt metrics for trials comparison drill-down.
 */
export const TrialsPromptComparisonSchema = z.object({
  /** Prompt identifier */
  id: z.string(),
  /** Run label of the capability winner, or null if tie */
  capabilityWinner: z.string().nullable(),
  /** Run label of the reliability winner, or null if tie */
  reliabilityWinner: z.string().nullable(),
  /** passAtK by run label */
  passAtK: z.record(z.string(), z.number()),
  /** passExpK by run label */
  passExpK: z.record(z.string(), z.number()),
  /** Flakiness by run label */
  flakiness: z.record(z.string(), z.number()),
})

/** Trials prompt comparison type */
export type TrialsPromptComparison = z.infer<typeof TrialsPromptComparisonSchema>

/**
 * Metadata for trials comparison report.
 */
export const TrialsComparisonMetaSchema = z.object({
  /** ISO timestamp when report was generated */
  generatedAt: z.string(),
  /** Run labels included in comparison */
  runs: z.array(z.string()),
  /** Total prompts compared */
  promptCount: z.number(),
  /** Number of trials per prompt (k value) */
  trialsPerPrompt: z.number(),
  /** Input format indicator */
  inputFormat: z.literal('trials'),
})

/** Trials comparison meta type */
export type TrialsComparisonMeta = z.infer<typeof TrialsComparisonMetaSchema>

/**
 * Trials comparison report schema.
 *
 * @remarks
 * Aggregates trials comparison output across capability, reliability, and flakiness dimensions.
 * Used when comparing TrialResult JSONL files instead of CaptureResult files.
 *
 * Key metrics:
 * - Capability: passAtK - can the agent solve this at least once?
 * - Reliability: passExpK - does the agent solve this consistently?
 * - Flakiness: passAtK - passExpK - how inconsistent is the agent?
 */
export const TrialsComparisonReportSchema = z.object({
  /** Report metadata */
  meta: TrialsComparisonMetaSchema,
  /** Capability metrics by run label */
  capability: z.record(z.string(), TrialsCapabilityMetricsSchema),
  /** Reliability metrics by run label */
  reliability: z.record(z.string(), TrialsReliabilityMetricsSchema),
  /** Flakiness metrics by run label */
  flakiness: z.record(z.string(), TrialsFlakinessMetricsSchema),
  /** Quality metrics by run label (only when grader scores are present) */
  quality: z.record(z.string(), TrialsQualityMetricsSchema).optional(),
  /** Performance metrics by run label (always present, uses trial.duration) */
  performance: z.record(z.string(), TrialsPerformanceMetricsSchema),
  /** Head-to-head comparison details */
  headToHead: z.object({
    /** Pairwise wins by capability */
    capability: z.array(PairwiseComparisonSchema),
    /** Pairwise wins by reliability */
    reliability: z.array(PairwiseComparisonSchema),
    /** Pairwise wins by overall weighted score */
    overall: z.array(PairwiseComparisonSchema),
  }),
  /** Per-prompt breakdown for drill-down (optional, can be large) */
  perPrompt: z.array(TrialsPromptComparisonSchema).optional(),
})

/** Trials comparison report type */
export type TrialsComparisonReport = z.infer<typeof TrialsComparisonReportSchema>
