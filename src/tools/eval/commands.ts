/**
 * CLI command implementations for agent evaluation harness.
 *
 * @remarks
 * Re-exports all CLI commands for programmatic use.
 * For CLI usage, run `agent-eval-harness <command> --help`.
 *
 * @packageDocumentation
 */

// Balance command
export type { BalanceConfig } from './commands/balance.ts'
export { balance, runBalance } from './commands/balance.ts'

// Calibrate command
export type { CalibrateConfig } from './commands/calibrate.ts'
export { calibrate, runCalibrate } from './commands/calibrate.ts'

// Capture command
export type { CaptureConfig } from './commands/capture.ts'
export { capture, runCapture } from './commands/capture.ts'

// Summarize command
export type { SummarizeConfig } from './commands/summarize.ts'
export { runSummarize, summarize } from './commands/summarize.ts'

// Trials command
export type { TrialsConfig } from './commands/trials.ts'
export { runTrials, trials } from './commands/trials.ts'

// Validate-refs command
export type { ValidateRefsConfig } from './commands/validate-refs.ts'
export { runValidateRefs, validateRefs } from './commands/validate-refs.ts'
