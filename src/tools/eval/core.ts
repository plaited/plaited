/**
 * Core utilities re-export.
 *
 * @remarks
 * Public API for core utilities. Import from here for external use.
 *
 * @packageDocumentation
 */

export {
  // Loading
  buildResultsIndex,
  countLines,
  // Native streaming
  countLinesStreaming,
  // Worker pool
  createWorkspaceDir,
  createWriteMutex,
  // Trajectory
  detectTrajectoryRichness,
  extractContent,
  extractFilePath,
  extractOutput,
  extractTrajectory,
  // Output
  getInputPreview,
  hasToolErrors,
  headTailPreview,
  loadJsonl,
  loadPrompts,
  loadResults,
  logProgress,
  type ProgressCallback,
  readStdinPrompts,
  resolvePath,
  runWorkerPool,
  streamJsonl,
  streamPrompts,
  streamResults,
  streamResultsNative,
  streamTrialResults,
  type WorkerPoolOptions,
  type WorkerPoolResult,
  type WriteMutex,
  writeOutput,
} from './core/core.ts'
