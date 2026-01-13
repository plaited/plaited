/**
 * Headless ACP (Agent Client Protocol) client for evaluation.
 *
 * @remarks
 * This module provides a programmatic client for interacting with
 * ACP-compatible agents like Claude Code, Droid, Gemini CLI, and others.
 * Designed for automated testing and evaluation workflows.
 *
 * **Important:** For SDK types (ToolCall, ContentBlock, SessionNotification, etc.),
 * import directly from `@agentclientprotocol/sdk`. This module only exports
 * Plaited-specific client utilities.
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
 * See tests in `src/acp/tests/` for usage patterns.
 */

export * from './acp/acp-client.ts'
export * from './acp/acp-helpers.ts'
