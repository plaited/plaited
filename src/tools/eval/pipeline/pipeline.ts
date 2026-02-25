/**
 * Pipeline commands for Unix-style composable evaluation.
 *
 * @remarks
 * Re-exports pipeline commands and types.
 *
 * Commands:
 * - run: Execute prompts and output raw results
 * - extract: Parse raw output into trajectories
 * - grade: Apply grader to extracted results
 * - format: Convert results to different output formats
 * - compare: Compare multiple runs of the same prompts
 *
 * @packageDocumentation
 */

// Commands
export { type CompareStrategy, compare, type ExtendedCompareConfig, runCompare } from './compare.ts'
export { extract } from './extract.ts'
export { format } from './format.ts'
export { grade } from './grade.ts'
// Types
export type {
  CompareConfig,
  ComparisonGrader,
  ComparisonGraderInput,
  ComparisonGraderResult,
  ComparisonRanking,
  ComparisonResult,
  ComparisonRunData,
  ExtractConfig,
  ExtractedResult,
  FormatConfig,
  FormatStyle,
  GradeConfig,
  GradedResult,
  LabeledRun,
  RawOutput,
  RunConfig,
  RunMode,
} from './pipeline.types.ts'
export { run } from './run.ts'
