/**
 * @internal
 * @module ai.types
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
import type {
  EventDetails,
  BSync,
  BThreads,
  BThread,
  Disconnect,
  PlaitedTrigger,
  UseSnapshot,
  Handlers,
} from '../behavioral.js'

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
 * Event detail payload for prompt handlers.
 * Includes Promise resolvers and typed arguments based on schema.
 * Zod schemas are automatically inferred to their runtime types.
 */
export type PromptDetail<T extends PromptConfig['argsSchema']> = {
  resolve: ReturnType<typeof Promise.withResolvers<GetPromptResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<GetPromptResult>>['reject']
  args: T extends undefined ? never
  : T extends z.ZodRawShape ? z.infer<z.ZodObject<T>>
  : T
  server: McpServer
}

export type PromptHandler<ArgsSchema extends PromptConfig['argsSchema']> = (
  detail: PromptDetail<ArgsSchema>,
) => void | Promise<void>

export type UsePrompt = <ArgsSchema extends PromptConfig['argsSchema']>(
  params: Omit<PromptConfig, 'argsSchema'> & {
    argsSchema: ArgsSchema
    handler: PromptHandler<ArgsSchema>
  },
) => {
  entry: PromptEntry
  handler: PromptHandler<ArgsSchema>
}

/**
 * @internal
 * Event detail payload for resource handlers.
 * Args type depends on whether resource uses static URI or template.
 * Static resources receive [URL], templates receive [URL, params].
 */
export type ResourceDetail<T extends ResourceConfig['uriOrTemplate']> = {
  resolve: ReturnType<typeof Promise.withResolvers<ReadResourceResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<ReadResourceResult>>['reject']
  args: T extends string ? [URL] : [URL, Record<string, string | string[]>]
  server: McpServer
}

export type ResourceHandler<UriOrTemplate extends ResourceConfig['uriOrTemplate']> = (
  detail: ResourceDetail<UriOrTemplate>,
) => void | Promise<void>

export type UseResource = <UriOrTemplate extends ResourceConfig['uriOrTemplate']>(
  params: Omit<ResourceConfig, 'uriOrTemplate'> & {
    uriOrTemplate: UriOrTemplate
    handler: ResourceHandler<UriOrTemplate>
  },
) => {
  entry: ResourceEntry
  handler: ResourceHandler<UriOrTemplate>
}

/**
 * @internal
 * Event detail payload for tool handlers.
 * Includes Promise resolvers and typed arguments based on input schema.
 * Supports both Zod schemas and raw JSON schema objects.
 */
export type ToolDetail<T extends ToolConfig['inputSchema']> = {
  resolve: ReturnType<typeof Promise.withResolvers<CallToolResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<CallToolResult>>['reject']
  args: T extends z.ZodRawShape ? z.infer<z.ZodObject<T>> : T
  server: McpServer
}

export type ToolHandler<InputSchema extends ToolConfig['inputSchema']> = (
  detail: ToolDetail<InputSchema>,
) => void | Promise<void>

export type UseTool = <InputSchema extends ToolConfig['inputSchema']>(
  params: Omit<ToolConfig, 'inputSchema'> & {
    inputSchema: InputSchema
    handler: ToolHandler<InputSchema>
  },
) => {
  entry: ToolEntry
  handler: ToolHandler<InputSchema>
}

/**
 * @internal
 * Registry type for declaring all MCP primitives in a server.
 * Maps string keys to primitive entries for type-safe configuration.
 */
export type Registry = {
  [k: string]: // eslint-disable-next-line @typescript-eslint/no-explicit-any
  | { entry: PromptEntry; handler: PromptHandler<any> }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { entry: ResourceEntry; handler: ResourceHandler<any> }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    | { entry: ToolEntry; handler: ToolHandler<any> }
}

/**
 * @internal
 * Type-safe collection of registered prompts extracted from registry.
 * Maps registry keys to RegisteredPrompt instances for lifecycle management.
 */
export type Prompts<Entries extends Registry = Registry> = {
  [K in keyof Entries as Entries[K]['entry'] extends PromptEntry ? K : never]: RegisteredPrompt
}

/**
 * @internal
 * Type-safe collection of registered resources extracted from registry.
 * Conditional types ensure correct registered type based on URI vs template.
 */
export type Resources<Entries extends Registry = Registry> = {
  [K in keyof Entries as Entries[K]['entry'] extends ResourceEntry ? K : never]: Entries[K]['entry'] extends (
    ResourceEntry
  ) ?
    Entries[K]['entry']['config']['uriOrTemplate'] extends ResourceTemplate ?
      RegisteredResourceTemplate
    : RegisteredResource
  : never
}

/**
 * @internal
 * Type-safe collection of registered tools extracted from registry.
 * Maps registry keys to RegisteredTool instances for lifecycle management.
 */
export type Tools<Entries extends Registry> = {
  [K in keyof Entries as Entries[K]['entry'] extends ToolEntry ? K : never]: RegisteredTool
}

export type BServerParams<R extends Registry, E extends Exclude<EventDetails, keyof R> | undefined> =
  E extends Exclude<EventDetails, keyof R> ?
    {
      name: string
      version: string
      registry: R
      bProgram: (args: {
        bSync: BSync
        bThread: BThread
        bThreads: BThreads
        disconnect: Disconnect
        server: McpServer
        trigger: PlaitedTrigger
        useSnapshot: UseSnapshot
        prompts: Prompts<R>
        resources: Resources<R>
        tools: Tools<R>
      }) => Promise<Handlers<E>>
    }
  : {
      name: string
      version: string
      registry: R
      bProgram?: never
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
