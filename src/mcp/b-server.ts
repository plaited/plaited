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
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  type BSync,
  type BThread,
  bThread,
  bSync,
  type EventDetails,
  type UseSnapshot,
  type BThreads,
  behavioral,
  type Disconnect,
  getPlaitedTrigger,
  type PlaitedTrigger,
} from '../behavioral.js'

import type { Registry, PrimitiveHandlers, Resources, Prompts, Tools } from './mcp.types.js'
import { registerPrompt, registerResource, registerTool } from './mcp.utils.js'

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
export const bServer = async <R extends Registry, E extends EventDetails>({
  registry,
  name,
  version,
  ...args
}: {
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
  }) => Promise<PrimitiveHandlers<R, E>>
}) => {
  /**
   * @internal
   * Create the MCP server instance with provided metadata.
   * This server will handle all MCP protocol communication.
   */
  const server = new McpServer({
    name,
    version,
  })

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
  for (const [name, { primitive, config }] of Object.entries(registry)) {
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
  const handlers = await args.bProgram({
    bSync,
    bThread,
    disconnect,
    server,
    trigger,
    prompts,
    resources,
    tools,
    ...rest,
  })

  /**
   * @internal
   * Connect handlers to the behavioral program's feedback loop.
   * This completes the event flow: MCP → signals → triggers → handlers.
   */
  useFeedback(handlers)

  return server
}
