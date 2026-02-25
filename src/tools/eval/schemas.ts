/**
 * Schemas and types for agent evaluation harness.
 *
 * @remarks
 * Re-exports all Zod schemas and inferred types for capture results,
 * trajectories, grader results, and CLI data structures.
 *
 * @packageDocumentation
 */

// Constants
export {
  DEFAULT_CALIBRATION_SAMPLE_SIZE,
  DEFAULT_HARNESS_TIMEOUT,
  DEFAULT_TRIAL_COUNT,
  HEAD_LINES,
  MAX_CONTENT_LENGTH,
  TAIL_LINES,
} from './schemas/constants.ts'
// Grader loader
export { loadGrader, loadGraderOrExit } from './schemas/grader-loader.ts'
// Core session types
// JSON-RPC types (MCP compatibility)
// MCP server configuration
// Prompt and grading
// Trajectory types
// Timing and richness
// Result types
export {
  type BalanceAnalysis,
  BalanceAnalysisSchema,
  type CalibrationSample,
  CalibrationSampleSchema,
  type CaptureResult,
  CaptureResultSchema,
  type CategoryDistribution,
  CategoryDistributionSchema,
  // Comparison report types
  type ComparisonMeta,
  ComparisonMetaSchema,
  type ComparisonReport,
  ComparisonReportSchema,
  EnvVariableSchema,
  type Grader,
  type GraderResult,
  GraderResultSchema,
  type HeadToHead,
  HeadToHeadSchema,
  HttpHeaderSchema,
  type IndexedStep,
  type JsonRpcError,
  type JsonRpcErrorResponse,
  JsonRpcErrorResponseSchema,
  JsonRpcErrorSchema,
  type JsonRpcMessage,
  JsonRpcMessageSchema,
  type JsonRpcNotification,
  JsonRpcNotificationSchema,
  type JsonRpcRequest,
  JsonRpcRequestSchema,
  type JsonRpcResponse,
  JsonRpcResponseSchema,
  type JsonRpcSuccessResponse,
  JsonRpcSuccessResponseSchema,
  type LatencyStats,
  LatencyStatsSchema,
  type McpServerConfig,
  McpServerHttpSchema,
  McpServerSchema,
  McpServerStdioSchema,
  MessageStepSchema,
  type PairwiseComparison,
  PairwiseComparisonSchema,
  type PerformanceMetrics,
  PerformanceMetricsSchema,
  PlanStepSchema,
  type PromptCase,
  PromptCaseSchema,
  type PromptComparison,
  PromptComparisonSchema,
  type QualityMetrics,
  QualityMetricsSchema,
  type ReliabilityMetrics,
  ReliabilityMetricsSchema,
  type ScoreDistribution,
  ScoreDistributionSchema,
  type Session,
  SessionSchema,
  type SummaryResult,
  SummaryResultSchema,
  ThoughtStepSchema,
  type Timing,
  TimingSchema,
  ToolCallStepSchema,
  type ToolInput,
  ToolInputSchema,
  type TrajectoryInfo,
  TrajectoryInfoSchema,
  type TrajectoryRichness,
  TrajectoryRichnessSchema,
  type TrajectoryStep,
  TrajectoryStepSchema,
  type TrialEntry,
  TrialEntrySchema,
  type TrialResult,
  TrialResultSchema,
  // Trials comparison report types
  type TrialsCapabilityMetrics,
  TrialsCapabilityMetricsSchema,
  type TrialsComparisonMeta,
  TrialsComparisonMetaSchema,
  type TrialsComparisonReport,
  TrialsComparisonReportSchema,
  type TrialsFlakinessMetrics,
  TrialsFlakinessMetricsSchema,
  type TrialsPerformanceConfidenceIntervals,
  TrialsPerformanceConfidenceIntervalsSchema,
  type TrialsPerformanceMetrics,
  TrialsPerformanceMetricsSchema,
  type TrialsPromptComparison,
  TrialsPromptComparisonSchema,
  type TrialsQualityConfidenceIntervals,
  TrialsQualityConfidenceIntervalsSchema,
  type TrialsQualityMetrics,
  TrialsQualityMetricsSchema,
  type TrialsReliabilityMetrics,
  TrialsReliabilityMetricsSchema,
  type ValidationResult,
  ValidationResultSchema,
} from './schemas/schemas.ts'

// Schemas CLI
export type { SchemasConfig } from './schemas/schemas-cli.ts'
export { runSchemas, schemasCli } from './schemas/schemas-cli.ts'
