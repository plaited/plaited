/**
 * Unified tool registry — aggregates handlers, risk tags, and definitions
 * from all tool modules for agent dispatch.
 *
 * @remarks
 * The agent loop imports from this module to resolve tool names to
 * implementations. Each tool module exports its own handler, risk tags,
 * and ToolDefinition; this registry merges them into a single lookup.
 *
 * Tool modules:
 * - `crud.ts` — file I/O and shell execution
 * - `typescript-lsp.ts` — LSP-based codebase analysis
 * - `hypergraph.ts` — hypergraph memory queries (JSON-LD + WASM)
 *
 * @public
 */

import type { ToolDefinition } from '../agent/agent.schemas.ts'
import type { ToolHandler } from '../agent/agent.types.ts'
import { BUILT_IN_RISK_TAGS, builtInHandlers } from './crud.ts'
import { search, searchRiskTags, searchToolDefinition } from './hypergraph.ts'
import { lspHandler, lspRiskTags, lspToolSchema } from './typescript-lsp.ts'

// ============================================================================
// Handler Registry — tool name → ToolHandler
// ============================================================================

/**
 * All built-in tool handlers keyed by tool name.
 *
 * @remarks
 * Used by BP dispatch to look up the handler for an `execute` event's
 * tool call name. Merges handlers from all tool modules.
 *
 * @public
 */
export const toolHandlers: Record<string, ToolHandler> = {
  ...builtInHandlers,
  lsp: lspHandler,
  search,
}

// ============================================================================
// Risk Tag Registry — tool name → RISK_TAG[]
// ============================================================================

/**
 * Risk tag declarations for all built-in tools.
 *
 * @remarks
 * Gate bThread predicates inspect these tags to determine routing:
 * - `workspace`-only → execute directly (safe path)
 * - Empty/unknown tags → default-deny, routes to Simulate + Judge
 *
 * @public
 */
export const toolRiskTags: Record<string, string[]> = {
  ...BUILT_IN_RISK_TAGS,
  lsp: lspRiskTags,
  search: searchRiskTags,
}

// ============================================================================
// Tool Definitions — OpenAI function-calling format for inference
// ============================================================================

/**
 * Tool definitions in OpenAI function-calling format.
 *
 * @remarks
 * Passed to `Model.reason()` so the model knows what tools are available.
 * Crud tool definitions are generated from Zod schemas at the call site;
 * tools with complex schemas export pre-built ToolDefinition objects.
 *
 * @public
 */
export const toolDefinitions: ToolDefinition[] = [lspToolSchema, searchToolDefinition]
