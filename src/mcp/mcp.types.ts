/**
 * @internal
 * @module mcp.types
 *
 * Purpose: Type definitions for Model Context Protocol integration with Plaited
 * Architecture: Provides type-safe interfaces between MCP SDK and behavioral programming
 * Dependencies: Zod for schema validation, MCP SDK for protocol types, behavioral for events
 * Consumers: define-mcp-server.ts, mcp.utils.ts, and user MCP server implementations
 *
 * Maintainer Notes:
 * - This module defines the type system for MCP primitive registration and handling
 * - Registry pattern enables declarative server configuration with full type safety
 * - Detail types bridge MCP's Promise-based callbacks with behavioral event payloads
 * - Zod integration provides runtime validation matching TypeScript compile-time types
 * - Conditional types ensure correct handler signatures based on primitive configuration
 *
 * Common modification scenarios:
 * - Adding new MCP primitives: Extend Registry union and create corresponding types
 * - Changing handler signatures: Update Detail types and HandlerCallback
 * - Supporting new schema formats: Modify Zod type inference in Detail types
 * - Adding metadata: Extend Entry types with additional configuration
 *
 * Performance considerations:
 * - Type definitions have zero runtime cost
 * - Zod validation happens at MCP request time, not registration
 * - Registry size doesn't impact runtime performance
 *
 * Known limitations:
 * - Zod schemas must be defined inline (no schema references)
 * - Resource templates only support string parameters
 * - No support for streaming responses in current types
 */
import { z } from 'zod'
import type {
  McpServer,
  ResourceMetadata,
  ResourceTemplate,
  RegisteredTool,
  RegisteredPrompt,
  RegisteredResource,
  RegisteredResourceTemplate,
} from '@modelcontextprotocol/sdk/server/mcp.js'
import type { GetPromptResult, ReadResourceResult, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import type { StdioServerParameters } from '@modelcontextprotocol/sdk/client/stdio.js'
import type { StreamableHTTPClientTransportOptions } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import type { EventDetails } from '../behavioral.js'

/**
 * @internal
 * Configuration type for MCP prompt registration.
 * Extracts the config parameter type from MCP SDK's registerPrompt method.
 */
export type PromptConfig = Parameters<McpServer['registerPrompt']>[1]

/**
 * @internal
 * Configuration type for MCP resource registration.
 * Combines URI/template with metadata for resource access patterns.
 */
export type ResourceConfig = {
  metaData: ResourceMetadata
  uriOrTemplate: string | ResourceTemplate
}

/**
 * @internal
 * Configuration type for MCP tool registration.
 * Extracts the config parameter type from MCP SDK's registerTool method.
 */
export type ToolConfig = Parameters<McpServer['registerTool']>[1]

/**
 * @internal
 * Registry entry for prompt primitives.
 * Discriminated by 'prompt' primitive type for type narrowing.
 */
export type PromptEntry = {
  primitive: 'prompt'
  config: PromptConfig
}

/**
 * @internal
 * Registry entry for resource primitives.
 * Discriminated by 'resource' primitive type for type narrowing.
 */
export type ResourceEntry = {
  primitive: 'resource'
  config: ResourceConfig
}

/**
 * @internal
 * Registry entry for tool primitives.
 * Discriminated by 'tool' primitive type for type narrowing.
 */
export type ToolEntry = {
  primitive: 'tool'
  config: ToolConfig
}

/**
 * @internal
 * Registry type for declaring all MCP primitives in a server.
 * Maps string keys to primitive entries for type-safe configuration.
 */
export type Registry = {
  [k: string]: PromptEntry | ResourceEntry | ToolEntry
}

/**
 * @internal
 * Event detail payload for prompt handlers.
 * Includes Promise resolvers and typed arguments based on schema.
 * Zod schemas are automatically inferred to their runtime types.
 */
export type PromptDetail<T extends PromptEntry['config']['argsSchema']> = {
  resolve: ReturnType<typeof Promise.withResolvers<GetPromptResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<GetPromptResult>>['reject']
  args: T extends z.ZodRawShape ? z.infer<z.ZodObject<T>> : T
}

/**
 * @internal
 * Event detail payload for resource handlers.
 * Args type depends on whether resource uses static URI or template.
 * Static resources receive [URL], templates receive [URL, params].
 */
export type ResourceDetail<T extends ResourceEntry['config']['uriOrTemplate']> = {
  resolve: ReturnType<typeof Promise.withResolvers<ReadResourceResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<ReadResourceResult>>['reject']
  args: T extends string ? [URL] : [URL, Record<string, string | string[]>]
}

/**
 * @internal
 * Event detail payload for tool handlers.
 * Includes Promise resolvers and typed arguments based on input schema.
 * Supports both Zod schemas and raw JSON schema objects.
 */
export type ToolDetail<T extends ToolEntry['config']['inputSchema']> = {
  resolve: ReturnType<typeof Promise.withResolvers<CallToolResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<CallToolResult>>['reject']
  args: T extends z.ZodRawShape ? z.infer<z.ZodObject<T>> : T
}

/**
 * @internal
 * Type-safe collection of registered prompts extracted from registry.
 * Maps registry keys to RegisteredPrompt instances for lifecycle management.
 */
export type Prompts<Entries extends Registry = Registry> = {
  [K in keyof Entries]: Entries[K] extends PromptEntry ? RegisteredPrompt : unknown
}

/**
 * @internal
 * Type-safe collection of registered resources extracted from registry.
 * Conditional types ensure correct registered type based on URI vs template.
 */
export type Resources<Entries extends Registry = Registry> = {
  [K in keyof Entries]: Entries[K] extends ResourceEntry ?
    Entries[K]['config']['uriOrTemplate'] extends ResourceTemplate ? RegisteredResourceTemplate
    : Entries[K]['config']['uriOrTemplate'] extends string ? RegisteredResource
    : unknown
  : unknown
}

/**
 * @internal
 * Type-safe collection of registered tools extracted from registry.
 * Maps registry keys to RegisteredTool instances for lifecycle management.
 */
export type Tools<Entries extends Registry = Registry> = {
  [K in keyof Entries]: Entries[K] extends ToolEntry ? RegisteredTool : unknown
}

/**
 * @internal
 * Conditional type that generates correct handler signature based on entry type.
 * Maps primitive entries to their corresponding detail types for type safety.
 */
type HandlerCallback<Entry extends PromptEntry | ResourceEntry | ToolEntry> =
  Entry extends PromptEntry ? (detail: PromptDetail<Entry['config']['argsSchema']>) => void | Promise<void>
  : Entry extends ResourceEntry ? (detail: ResourceDetail<Entry['config']['uriOrTemplate']>) => void | Promise<void>
  : Entry extends ToolEntry ? (detail: ToolDetail<Entry['config']['inputSchema']>) => void | Promise<void>
  : (detail: { args: unknown }) => void | Promise<void>

/**
 * @internal
 * Type for behavioral event handlers without MCP primitives.
 * Used when only custom events are needed without MCP integration.
 */
export type StrictHandlers<Details extends EventDetails = EventDetails> = {
  [K in keyof Details]: (detail: Details[K]) => void | Promise<void>
}

/**
 * @internal
 * Combined handler type supporting both MCP primitives and custom events.
 * Registry entries become MCP handlers, other keys become standard event handlers.
 * This enables unified event handling for both MCP and application events.
 */
export type PrimitiveHandlers<Entries extends Registry, E extends EventDetails> = {
  [P in keyof Entries | keyof E]: P extends keyof Entries ? HandlerCallback<Entries[P]>
  : P extends keyof E ? (detail: E[P]) => void | Promise<void>
  : never
}

/**
 * @internal
 * MCP Client types for behavioral integration
 */

/**
 * @internal
 * Transport configuration for MCP client connections.
 * Supports stdio (subprocess) and SSE (HTTP) transports.
 */
export type ServerTransportConfigs = Record<
  string,
  | ({ type: 'stdio' } & StdioServerParameters)
  | {
      type: 'http'
      url: string
      options?: StreamableHTTPClientTransportOptions
    }
>

/**
 * @internal
 * Event detail for tool execution requests.
 * Includes tool name and typed arguments.
 */
export type CallToolDetail = {
  name: string
  arguments: unknown
}

/**
 * @internal
 * Event detail for resource read requests.
 * Includes resource URI for fetching.
 */
export type ReadResourceDetail = {
  uri: string
}

/**
 * @internal
 * Event detail for prompt completion requests.
 * Includes prompt name and typed arguments.
 */
export type GetPromptDetail = {
  name: string
  arguments: unknown
}

/**
 * @internal
 * Inference engine interface for AI model integration.
 * Provides a standard interface for different LLM providers.
 */
export interface InferenceEngine {
  /**
   * Generate a chat completion with optional tool calling.
   * @param params Chat parameters including messages and available tools
   * @returns Promise resolving to the model's response
   */
  chat(params: {
    messages: Array<{ role: string; content: string }>
    tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>
    temperature?: number
    maxTokens?: number
    systemPrompt?: string
  }): Promise<InferenceResponse>

  /**
   * Optional: Get embedding for text
   */
  embed?(text: string): Promise<number[]>

  /**
   * Optional: Stream chat completion
   */
  streamChat?(params: {
    messages: Array<{ role: string; content: string }>
    tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>
    onChunk: (chunk: InferenceStreamChunk) => void
  }): Promise<void>
}

/**
 * @internal
 * Response from an inference engine.
 */
export interface InferenceResponse {
  content?: string
  toolCalls?: Array<{
    id?: string
    name: string
    arguments: unknown
  }>
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'error'
  usage?: {
    promptTokens?: number
    completionTokens?: number
    totalTokens?: number
  }
}

/**
 * @internal
 * Chunk for streaming responses.
 */
export interface InferenceStreamChunk {
  content?: string
  toolCall?: {
    id?: string
    name?: string
    arguments?: string // Partial JSON string
  }
  finishReason?: string
}

/**
 * @internal
 * Built-in agent event types for intelligent behavior.
 * These events enable agent orchestration patterns.
 */
export type AgentEventDetails = {
  // High-level agent operations
  CHAT: { messages: Array<{ role: string; content: string }>; temperature?: number }
  THINK: { prompt: string; context?: unknown }
  PLAN: { goal: string; constraints?: string[] }
  EXECUTE_PLAN: { steps: Array<{ tool: string; arguments: unknown; description?: string }> }
  LEARN: { experience: unknown; outcome?: 'success' | 'failure' }

  // Agent state
  AGENT_STATE_CHANGED: { state: 'idle' | 'thinking' | 'executing' | 'error' }
  AGENT_CAPABILITY_ADDED: { capability: string; description?: string }
}

/**
 * @internal
 * Client event details for MCP operations.
 * Maps event types to their detail payloads.
 */
export type MCPClientEventDetails = {
  // Discovery events
  TOOLS_DISCOVERED: { tools: Array<{ name: string; description?: string; inputSchema?: unknown }> }
  RESOURCES_DISCOVERED: { resources: Array<{ uri: string; name?: string; description?: string; mimeType?: string }> }
  PROMPTS_DISCOVERED: { prompts: Array<{ name: string; description?: string; argsSchema?: unknown }> }

  // Operation events
  CALL_TOOL: CallToolDetail
  READ_RESOURCE: ReadResourceDetail
  GET_PROMPT: GetPromptDetail

  // Result events
  TOOL_RESULT: { name: string; result: CallToolResult }
  RESOURCE_RESULT: { uri: string; result: ReadResourceResult }
  PROMPT_RESULT: { name: string; result: GetPromptResult }

  // Lifecycle events
  CLIENT_CONNECTED: { capabilities: unknown }
  CLIENT_DISCONNECTED: { reason?: string }
  CLIENT_ERROR: { error: Error; operation?: string }
}

/**
 * @internal
 * Arguments provided to MCP client behavioral program.
 * Includes standard BP utilities and MCP-specific functionality.
 */
export type MCPClientBProgramArgs<_E extends EventDetails = EventDetails> = {
  // Standard BP utilities
  bSync: import('../behavioral.js').BSync
  bThread: import('../behavioral.js').BThread
  bThreads: import('../behavioral.js').BThreads
  disconnect: import('../behavioral.js').Disconnect
  trigger: import('../behavioral.js').PlaitedTrigger
  useSnapshot: import('../behavioral.js').UseSnapshot

  // MCP client instance
  client: import('@modelcontextprotocol/sdk/client/index.js').Client

  // Inference engine (if provided)
  inferenceEngine?: InferenceEngine

  // Reactive state
  capabilities: import('../behavioral.js').SignalWithInitialValue<unknown>
  tools: import('../behavioral.js').SignalWithInitialValue<MCPClientEventDetails['TOOLS_DISCOVERED']['tools']>
  resources: import('../behavioral.js').SignalWithInitialValue<
    MCPClientEventDetails['RESOURCES_DISCOVERED']['resources']
  >
  prompts: import('../behavioral.js').SignalWithInitialValue<MCPClientEventDetails['PROMPTS_DISCOVERED']['prompts']>
}
