/**
 * Pipeline commands re-export.
 *
 * @remarks
 * Public API for pipeline commands. Import from here for external use.
 *
 * @packageDocumentation
 */

export {
  // Types
  type CompareConfig,
  type ComparisonGrader,
  type ComparisonGraderInput,
  type ComparisonGraderResult,
  type ComparisonRanking,
  type ComparisonResult,
  // Commands
  compare,
  type ExtractConfig,
  type ExtractedResult,
  extract,
  type FormatConfig,
  type FormatStyle,
  format,
  type GradeConfig,
  type GradedResult,
  grade,
  type LabeledRun,
  type RawOutput,
  type RunConfig,
  type RunMode,
  run,
} from './pipeline/pipeline.ts'
