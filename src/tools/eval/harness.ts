/**
 * Harness commands for agent evaluation.
 *
 * @remarks
 * Re-exports all harness command modules for programmatic use.
 * For CLI usage, run `agent-eval-harness <command> --help`.
 *
 * **Commands:**
 * - `capture` - Core trajectory capture
 * - `trials` - Multi-run pass@k/pass^k analysis
 * - `summarize` - Derive compact views from results
 * - `calibrate` - Sample failures for grader review
 * - `validateRefs` - Check reference solutions
 * - `balance` - Analyze test set coverage
 * - `schemasCli` - Export JSON schemas
 * - `headless` - Schema-driven adapter for headless CLI agents
 *
 * @packageDocumentation
 */

export type { BalanceConfig } from './commands/balance.ts'
export { balance, runBalance } from './commands/balance.ts'
export type { CalibrateConfig } from './commands/calibrate.ts'
export { calibrate, runCalibrate } from './commands/calibrate.ts'
// Config types
export type { CaptureConfig } from './commands/capture.ts'
// Command implementations (for programmatic use)
export {
  capture,
  extractOutput,
  extractTrajectory,
  hasToolErrors,
  loadPrompts,
  runCapture,
} from './commands/capture.ts'
export type { SummarizeConfig } from './commands/summarize.ts'
export { runSummarize, summarize } from './commands/summarize.ts'
export type { TrialsConfig } from './commands/trials.ts'
export { runTrials, trials } from './commands/trials.ts'
export type { ValidateRefsConfig } from './commands/validate-refs.ts'
export { runValidateRefs, validateRefs } from './commands/validate-refs.ts'
export type { HeadlessAdapterConfig } from './headless.ts'
// Headless adapter factory
export { headless } from './headless.ts'
export type { SchemasConfig } from './schemas/schemas-cli.ts'
export { runSchemas, schemasCli } from './schemas/schemas-cli.ts'
