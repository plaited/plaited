/**
 * @internal
 * @module mcp.utils
 *
 * Purpose: Integration utilities for Model Context Protocol (MCP) server support in Plaited
 * Architecture: Bridges MCP SDK with Plaited's behavioral programming system
 * Dependencies: MCP SDK for server functionality, behavioral module for signals/triggers
 * Consumers: defineMCPServer high-level API, MCP server implementations
 *
 * Maintainer Notes:
 * - These utilities create a reactive bridge between MCP's callback-based API and Plaited's event system
 * - Each utility follows the same pattern: register with MCP, create signal, connect to trigger
 * - Signals are used to decouple MCP callbacks from behavioral program handlers
 * - Promise.withResolvers() is used for async resolution pattern (requires ES2024)
 * - All registrations return the original MCP registration object for cleanup
 * - Type safety is preserved through the entire pipeline from MCP to handlers
 *
 * Common modification scenarios:
 * - Adding new MCP features: Follow the same pattern (register, signal, trigger)
 * - Changing error handling: Modify the reject() calls in handler callbacks
 * - Adding validation: Insert between signal.set() and promise resolution
 *
 * Performance considerations:
 * - Signals are lightweight but create subscriptions - ensure proper cleanup
 * - Each registration creates a persistent callback in MCP server
 * - Promise creation per request has minimal overhead
 *
 * Known limitations:
 * - No built-in retry mechanism for failed MCP operations
 * - Error propagation depends on handler implementation
 * - Signals must be cleaned up when server is disposed
 */
import {
  McpServer,
  type RegisteredPrompt,
  type RegisteredResource,
  type RegisteredResourceTemplate,
  type ReadResourceCallback,
  type ReadResourceTemplateCallback,
  type ResourceTemplate,
  type ResourceMetadata,
  type RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js'
import type { GetPromptResult, ReadResourceResult, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { type PlaitedTrigger, type SignalWithoutInitialValue, useSignal } from '../behavioral.js'
import type { PromptDetail, ResourceDetail, ToolDetail } from './mcp.types.js'

/**
 * @internal
 * Type helper to extract the raw argument schema shape from MCP's registerPrompt.
 * Used to maintain type safety when passing arguments through the signal system.
 */
type PromptArgsRawShape = Exclude<Parameters<McpServer['registerPrompt']>[1]['argsSchema'], undefined>

/**
 * @internal
 * Registers an MCP prompt with reactive signal-based handling.
 *
 * Creates a bridge between MCP's callback-based prompt API and Plaited's event-driven architecture.
 * When the MCP server receives a prompt request, it triggers a Plaited event that can be handled
 * in the behavioral program.
 *
 * @param options Configuration object
 * @param options.server - The MCP server instance to register the prompt with
 * @param options.name - Unique identifier for the prompt
 * @param options.config - MCP prompt configuration including description and argument schema
 * @param options.trigger - Plaited trigger for dispatching prompt events to handlers
 *
 * @returns RegisteredPrompt object for managing the prompt lifecycle
 *
 * Architecture flow:
 * 1. MCP client requests prompt -> MCP server callback triggered
 * 2. Callback creates Promise with resolvers for async handling
 * 3. Signal is set with resolvers and request arguments
 * 4. Signal triggers Plaited event with prompt name
 * 5. Handler in bProgram receives event and calls resolve/reject
 * 6. Promise resolves/rejects, returning result to MCP client
 *
 * Example handler pattern:
 * ```ts
 * bProgram({ trigger }) {
 *   return {
 *     'prompt-name': ({ resolve, reject, args }) => {
 *       try {
 *         const result = processPrompt(args);
 *         resolve({ messages: [{ role: 'assistant', content: result }] });
 *       } catch (error) {
 *         reject(error);
 *       }
 *     }
 *   }
 * }
 * ```
 */
export const registerPrompt = ({
  server,
  name,
  config,
  trigger,
}: {
  server: McpServer
  name: Parameters<McpServer['registerPrompt']>[0]
  config: Parameters<McpServer['registerPrompt']>[1]
  trigger: PlaitedTrigger
}): RegisteredPrompt => {
  const signal: SignalWithoutInitialValue<PromptDetail<PromptArgsRawShape>> = useSignal()
  const prompt = server.registerPrompt<PromptArgsRawShape>(name, config, async (args) => {
    const { promise, resolve, reject } = Promise.withResolvers<GetPromptResult>()
    signal.set({
      resolve,
      reject,
      args,
    })
    return promise
  })
  signal.listen(name, trigger)
  return prompt
}

/**
 * @internal
 * Registers an MCP resource with reactive signal-based handling.
 *
 * Supports both static resources (fixed URI) and templated resources (dynamic URI with parameters).
 * Resources represent data that MCP clients can read, such as files, API responses, or computed values.
 *
 * @param options Configuration object
 * @param options.server - The MCP server instance to register the resource with
 * @param options.name - Unique identifier for the resource
 * @param options.config - Resource configuration
 * @param options.config.uriOrTemplate - Either a static URI string or ResourceTemplate object
 * @param options.config.metaData - Resource metadata including MIME type and description
 * @param options.trigger - Plaited trigger for dispatching resource read events
 *
 * @returns RegisteredResource or RegisteredResourceTemplate for lifecycle management
 *
 * Type system notes:
 * - Conditional typing ensures correct callback signature based on uriOrTemplate type
 * - Static resources receive [URL] as args
 * - Templated resources receive [URL, Record<string, string | string[]>] with template params
 * - Type casting is necessary due to MCP SDK's overloaded signatures
 *
 * Common patterns:
 * - Static resource: File content, configuration data
 * - Templated resource: API endpoints with parameters, dynamic queries
 *
 * Example handlers:
 * ```ts
 * // Static resource
 * 'config-file': ({ resolve, args: [url] }) => {
 *   const content = await readFile(url.pathname);
 *   resolve({ contents: [{ text: content, mimeType: 'application/json' }] });
 * }
 *
 * // Templated resource
 * 'api-endpoint': ({ resolve, args: [url, params] }) => {
 *   const data = await fetchAPI(url, params);
 *   resolve({ contents: [{ text: JSON.stringify(data) }] });
 * }
 * ```
 */
export const registerResource = ({
  server,
  name,
  config,
  trigger,
}: {
  server: McpServer
  name: string
  config: {
    uriOrTemplate: string | ResourceTemplate
    metaData: ResourceMetadata
  }
  trigger: PlaitedTrigger
}): RegisteredResourceTemplate | RegisteredResource => {
  const signal: SignalWithoutInitialValue<ResourceDetail<typeof config.uriOrTemplate>> = useSignal()
  const callback: typeof config.uriOrTemplate extends ResourceTemplate ? ReadResourceTemplateCallback
  : ReadResourceCallback = async (...args) => {
    const { promise, resolve, reject } = Promise.withResolvers<ReadResourceResult>()
    signal.set({
      resolve,
      reject,
      args: args as unknown as [URL] | [URL, Record<string, string | string[]>],
    })
    return promise
  }
  const resource = server.registerResource(name, config.uriOrTemplate, config.metaData, callback)
  signal.listen(name, trigger)
  return resource
}

/**
 * @internal
 * Registers an MCP tool with reactive signal-based handling.
 *
 * Tools represent executable actions that MCP clients can invoke, such as running commands,
 * calling APIs, or performing computations. This is the most powerful MCP feature.
 *
 * @param options Configuration object
 * @param options.server - The MCP server instance to register the tool with
 * @param options.name - Unique identifier for the tool
 * @param options.config - Tool configuration including description and JSON schema for inputs
 * @param options.trigger - Plaited trigger for dispatching tool execution events
 *
 * @returns RegisteredTool object for managing the tool lifecycle
 *
 * Implementation details:
 * - Input validation is handled by MCP SDK based on provided JSON schema
 * - Tools should be idempotent when possible for safety
 * - Long-running operations should provide progress updates via isProgress flag
 * - Errors should be descriptive as they're shown to end users
 *
 * Security considerations:
 * - Tools can perform any action - validate inputs carefully
 * - Consider rate limiting for expensive operations
 * - Log tool executions for audit trails
 * - Sanitize any file paths or system commands
 *
 * Example handler:
 * ```ts
 * 'search-files': async ({ resolve, reject, args }) => {
 *   try {
 *     const { pattern, directory } = args;
 *     const files = await searchFiles(pattern, directory);
 *
 *     resolve({
 *       content: [
 *         { type: 'text', text: `Found ${files.length} files` },
 *         { type: 'text', text: files.join('\n') }
 *       ]
 *     });
 *   } catch (error) {
 *     reject(new Error(`Search failed: ${error.message}`));
 *   }
 * }
 * ```
 *
 * Progress updates for long operations:
 * ```ts
 * resolve({
 *   isProgress: true,
 *   content: [{ type: 'text', text: 'Processing 50%...' }]
 * });
 * ```
 */
export const registerTool = ({
  server,
  name,
  config,
  trigger,
}: {
  server: McpServer
  name: Parameters<McpServer['registerTool']>[0]
  config: Parameters<McpServer['registerTool']>[1]
  trigger: PlaitedTrigger
}): RegisteredTool => {
  const signal: SignalWithoutInitialValue<ToolDetail<(typeof config)['inputSchema']>> = useSignal()
  const tool = server.registerTool(name, config, async (args) => {
    const { promise, resolve, reject } = Promise.withResolvers<CallToolResult>()
    signal.set({
      resolve,
      reject,
      args,
    })
    return promise
  })
  signal.listen(name, trigger)
  return tool
}

/**
 * @internal
 * Creates reactive signals for MCP client primitive discovery.
 *
 * Provides a reactive way to track available tools, resources, and prompts
 * from an MCP server. Signals update automatically when primitives change.
 *
 * @param client - The MCP client instance to monitor
 * @param trigger - Plaited trigger for dispatching discovery events
 *
 * @returns Object containing signals for each primitive type
 *
 * Architecture notes:
 * - Signals start empty and populate after connection
 * - Each signal triggers a corresponding discovery event
 * - Signals can be subscribed to for reactive UI updates
 * - Discovery happens automatically on client connection
 *
 * Example usage:
 * ```ts
 * const { tools, resources, prompts } = createDiscoverySignals(client, trigger);
 * 
 * // React to tool discovery
 * tools.listen('TOOLS_UPDATED', componentTrigger);
 * 
 * // Access current tools
 * const currentTools = tools.get();
 * ```
 */
export const createDiscoverySignals = (
  client: import('@modelcontextprotocol/sdk/client/index.js').Client,
  trigger: PlaitedTrigger
) => {
  const tools = useSignal<Array<{ name: string; description?: string; inputSchema?: unknown }>>([])
  const resources = useSignal<Array<{ uri: string; name?: string; description?: string; mimeType?: string }>>([])
  const prompts = useSignal<Array<{ name: string; description?: string; argsSchema?: unknown }>>([])

  // Set up discovery listeners
  tools.listen('TOOLS_DISCOVERED', trigger)
  resources.listen('RESOURCES_DISCOVERED', trigger)
  prompts.listen('PROMPTS_DISCOVERED', trigger)

  return { tools, resources, prompts }
}

/**
 * @internal
 * Discovers and caches MCP server primitives.
 *
 * Queries the MCP server for available tools, resources, and prompts,
 * then updates the provided signals with the discovered primitives.
 *
 * @param client - The MCP client instance
 * @param signals - Discovery signals to update
 * @param trigger - Plaited trigger for error events
 *
 * Error handling:
 * - Failed discovery operations emit CLIENT_ERROR events
 * - Partial failures don't prevent other discoveries
 * - Empty results are valid (server may have no primitives)
 *
 * Performance notes:
 * - Discovery operations run in parallel
 * - Results are cached in signals
 * - Re-discovery can be triggered by calling again
 */
export const discoverPrimitives = async (
  client: import('@modelcontextprotocol/sdk/client/index.js').Client,
  signals: ReturnType<typeof createDiscoverySignals>,
  trigger: PlaitedTrigger
) => {
  try {
    // Discover all primitives in parallel
    const [toolsResult, resourcesResult, promptsResult] = await Promise.allSettled([
      client.listTools(),
      client.listResources(),
      client.listPrompts()
    ])

    // Update tools signal
    if (toolsResult.status === 'fulfilled') {
      signals.tools.set(toolsResult.value.tools)
    } else {
      trigger({ type: 'CLIENT_ERROR', detail: { error: toolsResult.reason, operation: 'listTools' } })
    }

    // Update resources signal
    if (resourcesResult.status === 'fulfilled') {
      signals.resources.set(resourcesResult.value.resources)
    } else {
      trigger({ type: 'CLIENT_ERROR', detail: { error: resourcesResult.reason, operation: 'listResources' } })
    }

    // Update prompts signal
    if (promptsResult.status === 'fulfilled') {
      signals.prompts.set(promptsResult.value.prompts)
    } else {
      trigger({ type: 'CLIENT_ERROR', detail: { error: promptsResult.reason, operation: 'listPrompts' } })
    }
  } catch (error) {
    trigger({ 
      type: 'CLIENT_ERROR', 
      detail: { 
        error: error instanceof Error ? error : new Error(String(error)), 
        operation: 'discoverPrimitives' 
      } 
    })
  }
}

/**
 * @internal
 * Creates a transport for MCP client based on configuration.
 *
 * Supports both stdio (subprocess) and SSE (HTTP) transports.
 * Stdio is the most common for local MCP servers.
 *
 * @param config - Transport configuration
 * @returns MCP transport instance
 *
 * Transport selection:
 * - stdio: For local servers (npm packages, executables)
 * - SSE: For remote HTTP-based servers
 *
 * Security notes:
 * - Validate command paths for stdio to prevent injection
 * - Use environment variables for sensitive data
 * - SSE headers may contain auth tokens
 */
export const createTransport = async (
  config: import('./mcp.types.js').MCPTransportConfig
): Promise<unknown> => {
  if (config.type === 'stdio') {
    const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js')
    return new StdioClientTransport({
      command: config.command,
      args: config.args,
      env: config.env
    })
  } else {
    const { SSEClientTransport } = await import('@modelcontextprotocol/sdk/client/sse.js')
    // SSEClientTransport doesn't support headers in constructor
    // Headers should be set via fetch options or environment
    return new SSEClientTransport(new URL(config.url))
  }
}
