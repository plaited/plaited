/**
 * Type definitions for pipeline commands.
 *
 * @remarks
 * These types define the data flow between pipeline stages:
 * run → extract → grade → format
 *
 * Each stage transforms the data, enabling Unix-style piping.
 *
 * @packageDocumentation
 */

import type { GraderResult, TrajectoryStep, TrialEntry } from '../schemas.ts'

/**
 * Raw output from the `run` command.
 *
 * @remarks
 * Captures the raw agent output before trajectory extraction.
 * Used when piping `run` output to `extract`.
 */
export type RawOutput = {
  /** Test case identifier */
  id: string
  /** Original prompt input (string for single turn, array for multi-turn) */
  input: string | string[]
  /** Grader context hint */
  hint?: string
  /** Optional metadata from original prompt */
  metadata?: Record<string, unknown>
  /** Raw output lines from the agent (JSON strings) */
  rawLines: string[]
  /** Timing metadata */
  timing: {
    start: number
    end: number
    total: number
  }
  /** Error message if execution failed */
  error?: string
}

/**
 * Extracted result from the `extract` command.
 *
 * @remarks
 * Converts raw output lines into structured trajectory and output.
 * Ready for grading or formatting.
 */
export type ExtractedResult = {
  /** Test case identifier */
  id: string
  /** Original prompt input */
  input: string | string[]
  /** Grader context hint */
  hint?: string
  /** Final agent output (extracted from trajectory) */
  output: string
  /** Parsed trajectory steps */
  trajectory: TrajectoryStep[]
  /** Whether tool errors were detected */
  toolErrors: boolean
  /** Optional metadata from original prompt */
  metadata?: Record<string, unknown>
  /** Working directory path (optional, for git-based grading) */
  cwd?: string
  /** Timing metadata */
  timing: {
    start: number
    end: number
    total: number
  }
  /** Error message if extraction failed */
  error?: string
}

/**
 * Graded result from the `grade` command.
 *
 * @remarks
 * Adds grader score to extracted result.
 * Outcome field is merged from grader result if present.
 */
export type GradedResult = ExtractedResult & {
  /** Grader score */
  score: GraderResult
  /** Outcome data from grader (if grader returned outcome) */
  outcome?: Record<string, unknown>
}

/**
 * Run mode for the pipeline run command.
 *
 * @remarks
 * - `schema`: Use headless adapter with schema file
 * - `simple`: Use Bun shell with placeholder substitution
 * - `shell`: Use Bun shell with PROMPT env variable
 */
export type RunMode = 'schema' | 'simple' | 'shell'

/**
 * Configuration for pipeline run command.
 */
export type RunConfig = {
  /** Run mode */
  mode: RunMode
  /** Path to schema file (for 'schema' mode) */
  schemaPath?: string
  /** Command template (for 'simple' mode) - {} is replaced with prompt */
  simpleCommand?: string
  /** Shell template (for 'shell' mode) - $PROMPT env var is available */
  shellTemplate?: string
  /** Working directory */
  cwd?: string
  /** Timeout per prompt in milliseconds */
  timeout?: number
  /** Show progress to stderr */
  progress?: boolean
}

/**
 * Configuration for pipeline extract command.
 */
export type ExtractConfig = {
  /** Path to schema file for output parsing */
  schemaPath: string
  /** Show progress to stderr */
  progress?: boolean
}

/**
 * Configuration for pipeline grade command.
 */
export type GradeConfig = {
  /** Path to grader module or executable */
  graderPath: string
  /** Show progress to stderr */
  progress?: boolean
}

/**
 * Output format for pipeline format command.
 */
export type FormatStyle = 'jsonl' | 'markdown' | 'csv'

/**
 * Configuration for pipeline format command.
 */
export type FormatConfig = {
  /** Output format style */
  style: FormatStyle
  /** Show progress to stderr */
  progress?: boolean
}

/**
 * Labeled run for comparison.
 *
 * @remarks
 * Associates a results file with a human-readable label
 * for the compare command output.
 */
export type LabeledRun = {
  /** Human-readable label (derived from filename or explicit) */
  label: string
  /** Path to results JSONL file */
  path: string
}

/**
 * Run data provided to comparison graders.
 *
 * @remarks
 * Extended run data includes optional fields that built-in graders use:
 * - `score`: Grader result if the run was previously graded
 * - `duration`: Total duration from timing
 * - `toolErrors`: Whether tool errors occurred
 */
export type ComparisonRunData = {
  /** Final agent output */
  output: string
  /** Execution trajectory (optional, varies by adapter) */
  trajectory?: TrajectoryStep[]
  /** Grader score (if run was graded) */
  score?: GraderResult
  /** Total duration in milliseconds */
  duration?: number
  /** Whether tool errors occurred */
  toolErrors?: boolean
}

/**
 * Input to comparison grader function.
 *
 * @remarks
 * Provides all runs' results for a single prompt ID
 * so the grader can compare and rank them.
 */
export type ComparisonGraderInput = {
  /** Test case identifier */
  id: string
  /** Original prompt input */
  input: string | string[]
  /** Grader context hint */
  hint?: string
  /** Optional metadata from original prompt */
  metadata?: Record<string, unknown>
  /** Results keyed by run label */
  runs: Record<string, ComparisonRunData>
}

/**
 * Single ranking entry in comparison result.
 */
export type ComparisonRanking = {
  /** Run label */
  run: string
  /** Rank position (1 = best) */
  rank: number
  /** Numeric score */
  score: number
}

/**
 * Result from comparison grader function.
 *
 * @remarks
 * Rankings should be ordered from best to worst.
 */
export type ComparisonGraderResult = {
  /** Rankings from best to worst */
  rankings: ComparisonRanking[]
  /** Optional reasoning for the rankings */
  reasoning?: string
}

/**
 * Comparison grader function type.
 *
 * @remarks
 * User-provided graders implement this interface to compare
 * multiple runs of the same prompt.
 */
export type ComparisonGrader = (params: ComparisonGraderInput) => Promise<ComparisonGraderResult>

/**
 * Configuration for pipeline compare command.
 */
export type CompareConfig = {
  /** Labeled runs to compare */
  runs: LabeledRun[]
  /** Path to comparison grader */
  graderPath: string
  /** Output file path */
  outputPath?: string
  /** Show progress to stderr */
  progress?: boolean
}

/**
 * Comparison result for a single prompt.
 */
export type ComparisonResult = {
  /** Test case identifier */
  id: string
  /** Original prompt input */
  input: string | string[]
  /** Grader context hint */
  hint?: string
  /** Rankings from comparison grader */
  rankings: ComparisonRanking[]
  /** Optional reasoning */
  reasoning?: string
}

// ============================================================================
// Trials Comparison Types
// ============================================================================

/**
 * Run data for trials comparison.
 *
 * @remarks
 * Contains the trials-specific metrics (passAtK, passExpK) plus
 * the individual trial entries for deeper analysis.
 */
export type TrialsComparisonRunData = {
  /** Simple pass rate: passes / k */
  passRate?: number
  /** pass@k: probability of at least one pass in k samples */
  passAtK?: number
  /** pass^k: probability of all k samples passing */
  passExpK?: number
  /** Number of trials (k) */
  k: number
  /** Individual trial results */
  trials: TrialEntry[]
}

/**
 * Input to trials comparison grader function.
 *
 * @remarks
 * Provides all runs' trial results for a single prompt ID
 * so the grader can compare capability and reliability.
 */
export type TrialsComparisonGraderInput = {
  /** Test case identifier */
  id: string
  /** Original prompt input */
  input: string | string[]
  /** Grader context hint */
  hint?: string
  /** Results keyed by run label */
  runs: Record<string, TrialsComparisonRunData>
}

/**
 * Trials comparison grader function type.
 *
 * @remarks
 * User-provided graders implement this interface to compare
 * multiple runs of the same prompt using trials data.
 */
export type TrialsComparisonGrader = (params: TrialsComparisonGraderInput) => Promise<ComparisonGraderResult>
