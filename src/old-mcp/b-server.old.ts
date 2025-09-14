/**
 * @internal
 * @module b-server
 *
 * Purpose: High-level API for creating Model Context Protocol servers with behavioral programming
 * Architecture: Integrates MCP SDK with Plaited's behavioral system for AI-powered tool execution
 * Dependencies: MCP SDK for protocol implementation, behavioral module for event-driven architecture
 * Consumers: Applications needing to expose tools, prompts, and resources to AI assistants
 *
 * Maintainer Notes:
 * - MCP (Model Context Protocol) enables AI assistants to interact with external systems
 * - This module creates the bridge between MCP's RPC-style API and Plaited's event system
 * - Registry pattern allows declarative configuration of MCP primitives
 * - All MCP callbacks are converted to behavioral events for consistent handling
 * - Server lifecycle is managed through disconnect callbacks and cleanup
 * - Type safety is preserved from registry definition through to event handlers
 *
 * Common modification scenarios:
 * - Supporting new MCP primitives: Add to registry types and registration loop
 * - Adding middleware: Intercept between MCP callback and trigger dispatch
 * - Custom server options: Extend the args parameter with MCP server config
 * - Error boundaries: Wrap useFeedback in try-catch for global error handling
 *
 * Performance considerations:
 * - Registry iteration happens once at startup - O(n) where n is primitive count
 * - Each MCP request creates a Promise and signal subscription
 * - Cleanup is synchronous but server.close() is async
 * - Large registries have minimal runtime impact
 *
 * Known limitations:
 * - No built-in rate limiting for MCP requests
 * - Server transport configuration not exposed (uses MCP defaults)
 * - Registry is static - cannot add/remove primitives at runtime
 * - No request context propagation between handlers
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
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js'
import type { GetPromptResult, ReadResourceResult, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import {
  behavioral,
  bSync,
  bThread,
  getPlaitedTrigger,
  useSignal,
  type Disconnect,
  type EventDetails,
  type PlaitedTrigger,
  type SignalWithoutInitialValue,
  type Handlers,
} from '../behavioral.js'
import type {
  Registry,
  Resources,
  Prompts,
  Tools,
  PromptDetail,
  ResourceDetail,
  ToolDetail,
  BServerParams,
} from './mcp.types.js'

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
const registerPrompt = ({
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
      server,
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
const registerResource = ({
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
      server,
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
const registerTool = ({
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
      server,
    })
    return promise
  })
  signal.listen(name, trigger)
  return tool
}

/**
 * Creates a Model Context Protocol (MCP) server with integrated behavioral programming.
 * Enables AI assistants to interact with your application through tools, prompts, and resources.
 *
 * @template R Registry type defining available MCP primitives
 * @template E EventDetails type for custom behavioral events
 *
 * @param options Configuration object for the server.
 * @param options.name The name of the MCP server, used for identification.
 * @param options.version The semantic version of the server (e.g., '1.0.0').
 * @param options.registry An object defining the tools, prompts, and resources to be exposed by this server.
 *                         The structure should conform to the `Registry` type.
 * @param options.bProgram An asynchronous function that defines the behavioral program for the server.
 *                         It receives context (including MCP primitive accessors like `tools`, `prompts`, `resources`,
 *                         the `McpServer` instance, and Plaited behavioral utilities) and should return an object
 *                         of `PrimitiveHandlers` that implement the logic for the registered MCP primitives.
 *
 * @returns A Promise that resolves to a configured `McpServer` instance, ready to be connected to a transport.
 *
 * @example Creating an MCP server for file operations
 * ```ts
 * const fileServer = await bServer({
 *   name: 'file-assistant',
 *   version: '1.0.0',
 *   registry: {
 *     // Tool for searching files
 *     searchFiles: {
 *       primitive: 'tool',
 *       config: {
 *         description: 'Search for files by pattern',
 *         inputSchema: z.object({
 *           pattern: z.string(),
 *           directory: z.string().optional()
 *         })
 *       }
 *     },
 *     // Resource for reading file contents
 *     fileContent: {
 *       primitive: 'resource',
 *       config: {
 *         uriOrTemplate: 'file:///{path}',
 *         metaData: {
 *           mimeType: 'text/plain',
 *           description: 'Read file contents'
 *         }
 *       }
 *     },
 *     // Prompt for generating file templates
 *     fileTemplate: {
 *       primitive: 'prompt',
 *       config: {
 *         description: 'Generate file from template',
 *         argsSchema: z.object({
 *           template: z.string(),
 *           variables: z.record(z.string())
 *         })
 *       }
 *     }
 *   },
 *   async bProgram({ trigger, tools, resources, prompts }) {
 *     // Initialize file system utilities
 *     const fs = await import('fs/promises');
 *
 *     return {
 *       // Handle file search tool
 *       searchFiles: async ({ resolve, reject, args }) => {
 *         try {
 *           const files = await glob(args.pattern, {
 *             cwd: args.directory || process.cwd()
 *           });
 *           resolve({
 *             content: [{
 *               type: 'text',
 *               text: files.join('\\n')
 *             }]
 *           });
 *         } catch (error) {
 *           reject(error);
 *         }
 *       },
 *
 *       // Handle file content resource
 *       fileContent: async ({ resolve, reject, args: [url] }) => {
 *         try {
 *           const content = await fs.readFile(url.pathname, 'utf-8');
 *           resolve({
 *             contents: [{
 *               text: content,
 *               mimeType: 'text/plain'
 *             }]
 *           });
 *         } catch (error) {
 *           reject(error);
 *         }
 *       },
 *
 *       // Handle template prompt
 *       fileTemplate: ({ resolve, args }) => {
 *         const rendered = renderTemplate(args.template, args.variables);
 *         resolve({
 *           messages: [{
 *             role: 'assistant',
 *             content: rendered
 *           }]
 *         });
 *       }
 *     };
 *   }
 * });
 *
 * // Connect to transport (stdio, HTTP, etc.)
 * const transport = new StdioTransport();
 * await fileServer.connect(transport);
 * ```
 *
 * @remarks
 * Registry Pattern:
 * - Declarative configuration of MCP primitives
 * - Type-safe from declaration to handler implementation
 * - Each entry becomes an event in the behavioral program
 * - Handlers receive typed arguments based on schemas
 *
 * Behavioral Integration:
 * - Full access to behavioral programming features
 * - Can coordinate between multiple MCP requests
 * - Supports async operations and state management
 * - Automatic cleanup on server shutdown
 *
 * Best Practices:
 * - Keep tool operations idempotent when possible
 * - Validate inputs beyond schema validation
 * - Provide clear error messages for AI context
 * - Use prompts for templating, tools for actions
 * - Resources should be read-only operations
 */

export const bServer =
  <R extends Registry, E extends Exclude<EventDetails, keyof R> | undefined = undefined>({
    registry,
    bProgram,
    serverInfo,
    options,
  }: BServerParams<R, E>) =>
  async (transport: Transport) => {
    /**
     * @internal
     * Create the MCP server instance with provided metadata.
     * This server will handle all MCP protocol communication.
     */
    const server = new McpServer(serverInfo, options)

    /**
     * @internal
     * Initialize behavioral program infrastructure.
     * Extract trigger and feedback mechanism for event handling.
     */
    const { trigger: _trigger, useFeedback, ...rest } = behavioral()

    /**
     * @internal
     * Set up lifecycle management for proper resource cleanup.
     * DisconnectSet accumulates all cleanup callbacks from registered primitives.
     */
    const disconnectSet = new Set<Disconnect>()
    const trigger = getPlaitedTrigger(_trigger, disconnectSet)

    /**
     * @internal
     * Initialize typed collections for registered MCP primitives.
     * These objects will be populated during registry processing.
     */
    const tools = {} as Tools<R>
    const prompts = {} as Prompts<R>
    const resources = {} as Resources<R>

    /**
     * @internal
     * Process registry entries and register each primitive with the MCP server.
     * Registration functions return handles that are stored for lifecycle management.
     * Object.assign is used to build up the typed collections incrementally.
     */
    const primitiveHandlers: Handlers = {}
    for (const [
      name,
      {
        handler,
        entry: { primitive, config },
      },
    ] of Object.entries(registry)) {
      Object.assign(primitiveHandlers, { [name]: handler })
      primitive === 'tool' && Object.assign(tools, { [name]: registerTool({ server, name, config, trigger }) })
      primitive === 'prompt' && Object.assign(prompts, { [name]: registerPrompt({ server, name, config, trigger }) })
      primitive === 'resource' &&
        Object.assign(resources, { [name]: registerResource({ server, name, trigger, config }) })
    }

    /**
     * @internal
     * Master disconnect function that cleans up all resources.
     * Runs all accumulated cleanup callbacks then closes the MCP server.
     * Note: server.close() is async but disconnect callbacks are sync.
     */
    const disconnect = async () => {
      disconnectSet.forEach((disconnect) => void disconnect())
      await server.close()
    }

    /**
     * @internal
     * Execute user's bProgram to get event handlers.
     * Provides full behavioral programming context plus MCP-specific utilities.
     * Await supports async initialization (e.g., database connections).
     */
    const handlers =
      bProgram &&
      (await bProgram({
        bSync,
        bThread,
        disconnect,
        server,
        trigger,
        prompts,
        resources,
        tools,
        ...rest,
      }))
    /**
     * @internal
     * Connect handlers to the behavioral program's feedback loop.
     * This completes the event flow: MCP → signals → triggers → handlers.
     */
    useFeedback({
      ...(handlers || {}),
      ...primitiveHandlers,
    })

    /**
     * @internal
     * Set up roots support after client initialization completes.
     * Checks client capabilities and sets up notification handler if supported.
     */
    return await server.connect(transport)
  }
