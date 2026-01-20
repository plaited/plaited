/**
 * Core type definitions for agent infrastructure.
 *
 * @remarks
 * Provides types for:
 * - Embedder configuration for vector search (via node-llama-cpp)
 * - Tool schemas for discovery and filtering
 *
 * @module
 */

// ============================================================================
// Embedder Types
// ============================================================================

/**
 * Embedder configuration for vector search via node-llama-cpp.
 *
 * @remarks
 * Uses GGUF models loaded in-process via llama.cpp bindings.
 * Models are auto-downloaded from Hugging Face on first use.
 *
 * Default model: `embeddinggemma-300M` (Q8_0 quantization, 256 dimensions)
 *
 * If model loading fails, vector search is gracefully disabled
 * and FTS5 keyword search is used instead.
 */
export type EmbedderConfig = {
  /**
   * Hugging Face model URI or local path to GGUF file.
   *
   * Supports:
   * - HF shorthand: `hf:ggml-org/embeddinggemma-300M-GGUF:Q8_0`
   * - Local path: `./models/embeddinggemma.gguf`
   *
   * @defaultValue `'hf:ggml-org/embeddinggemma-300M-GGUF:Q8_0'`
   */
  modelUri?: string
  /**
   * Directory to cache downloaded models.
   *
   * @defaultValue `'~/.cache/plaited/models'`
   */
  modelsDir?: string
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
