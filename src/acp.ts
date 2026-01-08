/**
 * Headless ACP (Agent Client Protocol) client for evaluation.
 *
 * @remarks
 * This module provides a programmatic client for interacting with
 * ACP-compatible agents like Claude Code, Droid, Gemini CLI, and others.
 * Designed for automated testing and evaluation workflows.
 *
 * **Core exports:**
 * - {@link createACPClient} - Factory for creating client instances
 * - {@link ACPClient} - Client type for type annotations
 *
 * **Helper utilities:**
 * - Content builders: {@link createTextContent}, {@link createPrompt}, etc.
 * - Extractors: {@link extractText}, {@link extractToolCalls}, etc.
 * - Analysis: {@link summarizeResponse}
 *
 * **Example usage:**
 * ```typescript
 * import { createACPClient, createPrompt, summarizeResponse } from 'plaited/acp'
 *
 * const client = createACPClient({
 *   command: ['claude', 'code'],
 *   cwd: '/path/to/project'
 * })
 *
 * await client.connect()
 * const session = await client.createSession()
 * const { result, updates } = await client.promptSync(
 *   session.id,
 *   createPrompt('List all TypeScript files')
 * )
 *
 * const summary = summarizeResponse(updates)
 * console.log('Response:', summary.text)
 * console.log('Tool calls:', summary.toolCallCount)
 *
 * await client.disconnect()
 * ```
 */

// Types
export type * from './acp/acp.types.ts'

// Client
export { type ACPClient, type ACPClientConfig, ACPClientError, createACPClient } from './acp/acp-client.ts'
// Helpers - Content builders
// Helpers - Extractors
// Helpers - Utilities
export {
  createAudioContent,
  createBlobResource,
  createImageContent,
  createPrompt,
  createPromptWithFiles,
  createPromptWithImage,
  createResourceLink,
  createTextContent,
  createTextResource,
  extractLatestToolCalls,
  extractPlan,
  extractText,
  extractTextFromUpdates,
  extractToolCalls,
  filterPlanByStatus,
  filterToolCallsByName,
  filterToolCallsByStatus,
  getCompletedToolCallsWithContent,
  getPlanProgress,
  hasToolCallErrors,
  type PromptResponseSummary,
  summarizeResponse,
} from './acp/acp-helpers.ts'
// Transport (for advanced use cases)
export { type ACPTransport, ACPTransportError, createACPTransport } from './acp/acp-transport.ts'
