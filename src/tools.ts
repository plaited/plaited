/**
 * Tools module for the Plaited framework.
 * Re-exports all tool implementations for programmatic use.
 *
 * @remarks
 * Each tool follows the tool genome pattern:
 * - `configSchema` — Zod schema (source of truth for --schema and --json validation)
 * - `run*()` — Programmatic runner (pure function, no CLI concerns)
 * - CLI handler — (args: string[]) => Promise<void>
 *
 * @public
 */

// Constitution (risk classification)
export {
  classifyRisk,
  constitutionRule,
  createConstitution,
  createGateCheck,
} from './tools/constitution/constitution.ts'
export type { Constitution, ConstitutionRule, ConstitutionRuleConfig } from './tools/constitution/constitution.types.ts'
// CRUD tools
export { builtInToolSchemas, createToolExecutor } from './tools/crud/crud.ts'
// Evaluate (judge scoring)
export {
  buildRewardPrompt,
  checkSymbolicGate,
  createEvaluate,
  DANGEROUS_PREDICTION_PATTERNS,
  parseRewardScore,
} from './tools/evaluate/evaluate.ts'
// Memory (FTS5 search)
export { createMemoryDb, createSearchHandler, searchToolSchema } from './tools/memory/memory.ts'
export type {
  EventLogEntry,
  EventLogRow,
  MemoryDb,
  MemoryDbOptions,
  MessageRow,
  SearchResultRow,
  SessionRow,
} from './tools/memory/memory.types.ts'
// Simulate (dreamer prediction)
export {
  buildStateTransitionPrompt,
  createSimulate,
  createSubAgentSimulate,
  parseSimulationResponse,
} from './tools/simulate/simulate.ts'
