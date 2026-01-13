/**
 * Core type definitions for agent infrastructure.
 *
 * @remarks
 * Provides types for:
 * - Embedder configuration for vector search (via Ollama)
 * - Tool schemas for discovery and filtering
 *
 * @module
 */

// ============================================================================
// Embedder Types
// ============================================================================

/**
 * Embedder configuration for vector search via Ollama.
 *
 * @remarks
 * Uses Ollama's local embedding models. The default model (`all-minilm`)
 * is lightweight (22MB) with 384 dimensions. Ollama must be installed
 * separately from https://ollama.com.
 *
 * If Ollama is not available, vector search is gracefully disabled
 * and FTS5 keyword search is used instead.
 */
export type EmbedderConfig = {
  /** Ollama model name for embeddings (default: 'all-minilm') */
  model?: string
  /** Ollama server URL (default: 'http://localhost:11434') */
  baseUrl?: string
  /** Whether to auto-start Ollama server if not running (default: true) */
  autoStart?: boolean
  /** Whether to auto-pull model if not downloaded (default: true) */
  autoPull?: boolean
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * JSON Schema for a tool's parameters.
 *
 * @remarks
 * Follows the OpenAI function calling schema format for compatibility
 * with various LLM providers.
 */
export type ToolSchema = {
  /** Unique tool name (used for invocation) */
  name: string
  /** Human-readable description of what the tool does */
  description: string
  /** Parameter schema following JSON Schema format */
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/**
 * Source identifier for tool routing.
 *
 * @remarks
 * Used to categorize tools by their origin:
 * - `local` - Built-in tools defined in the application
 * - `mcp` - Tools from Model Context Protocol servers
 * - `a2a` - Tools from Agent-to-Agent protocol peers
 * - `skill` - Tools from AgentSkills scripts
 */
export type ToolSource = 'local' | 'mcp' | 'a2a' | 'skill'
