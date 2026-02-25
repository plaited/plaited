/**
 * Headless adapter factory - schema-driven adapter for any CLI agent.
 *
 * @remarks
 * Re-exports public API from the headless module. The headless adapter enables
 * capturing trajectories from ANY headless CLI agent by defining a schema
 * that describes how to interact with the CLI.
 *
 * **CLI Usage:**
 * ```bash
 * agent-eval-harness headless --schema ./my-agent.json
 * ```
 *
 * **Programmatic Usage:**
 * ```typescript
 * import { parseHeadlessConfig, createSessionManager } from '@plaited/agent-eval-harness/headless'
 *
 * const schema = parseHeadlessConfig(jsonConfig)
 * const sessions = createSessionManager({ schema })
 * ```
 *
 * @packageDocumentation
 */

// Schema definitions and parsing
export {
  HeadlessAdapterSchema,
  OutputConfigSchema,
  OutputEventExtractSchema,
  OutputEventMappingSchema,
  OutputEventMatchSchema,
  PromptConfigSchema,
  parseHeadlessConfig,
  ResultConfigSchema,
  ResumeConfigSchema,
  safeParseHeadlessConfig,
} from './headless/headless.schemas.ts'
// Types
export type {
  HeadlessAdapterConfig,
  OutputConfig,
  OutputEventExtract,
  OutputEventMapping,
  OutputEventMatch,
  PromptConfig,
  ResultConfig,
  ResumeConfig,
} from './headless/headless.types.ts'
// CLI entry point
export { headless } from './headless/headless-cli.ts'
export type { HistoryBuilder, HistoryBuilderConfig, HistoryTurn } from './headless/headless-history-builder.ts'
// History builder
export { createHistoryBuilder } from './headless/headless-history-builder.ts'
export type {
  OutputParser,
  ParsedResult,
  ParsedUpdate,
  ResultParseResult,
  SessionUpdateType,
} from './headless/headless-output-parser.ts'
// Output parser
export { createOutputParser, jsonPath, jsonPathString } from './headless/headless-output-parser.ts'
export type {
  ProcessExitInfo,
  PromptResult,
  Session,
  SessionManager,
  SessionManagerConfig,
  UpdateCallback,
} from './headless/headless-session-manager.ts'
// Session manager
export { createSessionManager } from './headless/headless-session-manager.ts'
