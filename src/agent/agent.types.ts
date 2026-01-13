import type { DataType, DeviceType } from '@huggingface/transformers'

/**
 * Embedder configuration for vector search.
 *
 * @remarks
 * Models are cached locally after first download via Transformers.js.
 */
export type EmbedderConfig = {
  /** Model ID (default: 'Xenova/multilingual-e5-small') */
  model?: string
  /** Quantization level (default: 'q8') */
  dtype?: DataType
  /** Inference device (default: 'auto' - auto-detects GPU) */
  device?: DeviceType
}

// ============================================================================
// Tool Types
// ============================================================================

/**
 * A function call from the model.
 */
export type FunctionCall = {
  name: string
  arguments: string // JSON string
}

/**
 * Result of tool execution.
 */
export type ToolResult = {
  success: boolean
  data?: unknown
  error?: string
}

/**
 * Tool schema for model context.
 */
export type ToolSchema = {
  name: string
  description: string
  parameters: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

/**
 * Tool handler function.
 */
export type ToolHandler = (args: Record<string, unknown>) => Promise<ToolResult>

/**
 * Tool registry interface.
 */
export type ToolRegistry = {
  register: (name: string, handler: ToolHandler, schema: ToolSchema) => void
  execute: (call: FunctionCall) => Promise<ToolResult>
  schemas: ToolSchema[]
}

/**
 * Source of a tool (for routing).
 */
export type ToolSource = 'local' | 'mcp' | 'a2a' | 'skill'
