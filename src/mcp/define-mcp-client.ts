/**
 * @internal
 * @module define-mcp-client
 *
 * Purpose: High-level API for creating Model Context Protocol clients with behavioral programming
 * Architecture: Integrates MCP SDK client with Plaited's behavioral system for AI tool orchestration
 * Dependencies: MCP SDK for protocol implementation, behavioral module for event-driven architecture
 * Consumers: Applications needing to connect to MCP servers and use their tools/resources/prompts
 *
 * Maintainer Notes:
 * - MCP (Model Context Protocol) enables AI assistants to use tools from external servers
 * - This module creates the bridge between MCP's client API and Plaited's event system
 * - Reactive signals track available primitives and connection state
 * - All MCP operations are converted to behavioral events for consistent handling
 * - Client lifecycle is managed through disconnect callbacks and cleanup
 * - Type safety is preserved from configuration through to event handlers
 *
 * Common modification scenarios:
 * - Supporting new transports: Add to MCPTransportConfig and createTransport
 * - Adding client options: Extend MCPClientConfig with MCP client settings
 * - Custom discovery logic: Modify discoverPrimitives in utils
 * - Error recovery: Add retry logic in operation handlers
 *
 * Performance considerations:
 * - Discovery happens once on connection - cached in signals
 * - Each MCP operation creates a Promise for async handling
 * - Parallel operations are supported through behavioral events
 * - Large result sets should be paginated by the server
 *
 * Known limitations:
 * - No built-in retry mechanism for failed operations
 * - Transport reconnection must be handled externally
 * - No request queuing during disconnection
 * - Server capabilities not fully exposed
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  bThread,
  bSync,
  type EventDetails,
  bProgram,
  getPlaitedTrigger,
  type PlaitedTrigger,
  getPublicTrigger,
  useSignal,
  type Disconnect
} from '../behavioral.js'

import type { 
  MCPClientConfig
} from './mcp.types.js'
import { createTransport, createDiscoverySignals } from './mcp.utils.js'

/**
 * Creates a Model Context Protocol (MCP) client with integrated behavioral programming.
 * Enables applications to discover and use tools, resources, and prompts from MCP servers.
 *
 * @template E EventDetails type for custom behavioral events
 *
 * @param config Client configuration object
 * @param config.name MCP client name for identification
 * @param config.version Semantic version of the client
 * @param config.transport Connection settings for the MCP server
 * @param config.publicEvents Optional list of events accessible via public trigger
 * @param config.bProgram Async function returning behavioral event handlers
 *
 * @returns Async function that initializes the client and returns a public trigger
 *
 * @example Creating an MCP client for filesystem operations
 * ```ts
 * const createFileClient = defineMCPClient({
 *   name: 'file-client',
 *   version: '1.0.0',
 *   transport: {
 *     type: 'stdio',
 *     command: 'npx',
 *     args: ['-y', '@modelcontextprotocol/server-filesystem', '/home/user']
 *   },
 *   publicEvents: ['CALL_TOOL', 'READ_RESOURCE'],
 *   
 *   async bProgram({ client, tools, resources, trigger, bThread, bSync }) {
 *     // Auto-discover primitives on connection
 *     bThread([
 *       bSync({ 
 *         waitFor: 'CLIENT_CONNECTED',
 *         request: { type: 'DISCOVER_ALL' }
 *       })
 *     ])
 *     
 *     // Tool filtering based on context
 *     bThread([
 *       bSync({
 *         waitFor: 'FILTER_TOOLS',
 *         block: 'CALL_TOOL' // Block tool calls during filtering
 *       })
 *     ], true)
 *     
 *     return {
 *       // Handle tool discovery
 *       TOOLS_DISCOVERED({ tools: discovered }) {
 *         console.log(`Discovered ${discovered.length} tools`);
 *       },
 *       
 *       // Execute tool calls
 *       async CALL_TOOL({ name, arguments: args }) {
 *         try {
 *           const result = await client.callTool({ name, arguments: args });
 *           trigger({ type: 'TOOL_RESULT', detail: { name, result } });
 *         } catch (error) {
 *           trigger({ 
 *             type: 'CLIENT_ERROR', 
 *             detail: { error, operation: `callTool:${name}` } 
 *           });
 *         }
 *       },
 *       
 *       // Read resources
 *       async READ_RESOURCE({ uri }) {
 *         try {
 *           const result = await client.readResource({ uri });
 *           trigger({ type: 'RESOURCE_RESULT', detail: { uri, result } });
 *         } catch (error) {
 *           trigger({ 
 *             type: 'CLIENT_ERROR', 
 *             detail: { error, operation: `readResource:${uri}` } 
 *           });
 *         }
 *       },
 *       
 *       // Discover all primitives
 *       async DISCOVER_ALL() {
 *         await discoverPrimitives(client, { tools, resources, prompts }, trigger);
 *       }
 *     };
 *   }
 * });
 * 
 * // Initialize and connect
 * const fileClient = await createFileClient();
 * 
 * // Use the client
 * fileClient({ 
 *   type: 'CALL_TOOL', 
 *   detail: { 
 *     name: 'read_file',
 *     arguments: { path: './readme.md' }
 *   }
 * });
 * ```
 *
 * @remarks
 * Architecture Patterns:
 * - Factory pattern for reusable client configurations
 * - Event-driven communication for all MCP operations
 * - Reactive signals for primitive discovery and state
 * - Automatic cleanup on disconnect
 *
 * Behavioral Integration:
 * - Full access to bProgram features for complex orchestration
 * - Can coordinate multiple tool calls with b-threads
 * - Supports blocking/interrupting operations
 * - Integrates with other Plaited components
 *
 * Best Practices:
 * - Always handle CLIENT_ERROR events
 * - Discover primitives after connection
 * - Validate tool arguments before calling
 * - Use signals for reactive UI updates
 * - Implement proper cleanup in disconnect
 */
export const defineMCPClient = <E extends EventDetails = EventDetails>(
  config: MCPClientConfig<E>
) => {
  /**
   * Returns an async initialization function that creates the client instance
   * and sets up the behavioral program with all necessary event handlers.
   */
  return async (): Promise<PlaitedTrigger> => {
    /**
     * @internal
     * Create the MCP client instance with provided metadata.
     * This client will handle all MCP protocol communication.
     */
    const client = new Client(
      {
        name: config.name,
        version: config.version,
      },
      {
        capabilities: {} // Can be extended for custom capabilities
      }
    )

    /**
     * @internal
     * Initialize behavioral program infrastructure.
     * Extract trigger and feedback mechanism for event handling.
     */
    const { trigger: _trigger, useFeedback, ...rest } = bProgram()

    /**
     * @internal
     * Set up lifecycle management for proper resource cleanup.
     * DisconnectSet accumulates all cleanup callbacks.
     */
    const disconnectSet = new Set<Disconnect>()
    const trigger = getPlaitedTrigger(_trigger, disconnectSet)

    /**
     * @internal
     * Create reactive signals for tracking MCP server capabilities.
     * These signals enable reactive UI updates and state management.
     */
    const capabilities = useSignal<unknown>({})
    const { tools, resources, prompts } = createDiscoverySignals(client, trigger)

    /**
     * @internal
     * Create transport for later connection.
     * Transport handles the actual communication with MCP server.
     */
    const transport = await createTransport(config.transport) as Parameters<typeof client.connect>[0]

    /**
     * @internal
     * Register disconnect handler for proper cleanup.
     * Ensures client and transport are properly closed.
     */
    const disconnect = async () => {
      try {
        await client.close()
        trigger({ type: 'CLIENT_DISCONNECTED', detail: {} })
      } catch (error) {
        trigger({ 
          type: 'CLIENT_ERROR', 
          detail: { 
            error: error instanceof Error ? error : new Error(String(error)), 
            operation: 'disconnect' 
          } 
        })
      }
      disconnectSet.forEach((cb) => cb())
    }
    disconnectSet.add(disconnect)

    /**
     * @internal
     * Execute user's bProgram to get event handlers.
     * Provides full behavioral programming context plus MCP-specific utilities.
     */
    const handlers = await config.bProgram({
      bSync,
      bThread,
      disconnect,
      trigger,
      client,
      capabilities,
      tools,
      resources,
      prompts,
      ...rest,
    })

    /**
     * @internal
     * Connect handlers to the behavioral program's feedback loop.
     * This completes the event flow: operations → events → handlers.
     */
    useFeedback(handlers as unknown as Parameters<typeof useFeedback>[0])
    
    /**
     * @internal
     * Connect to MCP server after handlers are registered.
     * This ensures CLIENT_CONNECTED event is properly handled.
     */
    try {
      await client.connect(transport)
      
      // Get server info after connection
      const _serverInfo = client.getServerVersion()
      const serverCapabilities = client.getServerCapabilities()
      
      // Update capabilities signal
      capabilities.set(serverCapabilities || {})
      
      // Notify successful connection
      trigger({ 
        type: 'CLIENT_CONNECTED', 
        detail: { capabilities: serverCapabilities || {} } 
      })
    } catch (error) {
      trigger({ 
        type: 'CLIENT_ERROR', 
        detail: { 
          error: error instanceof Error ? error : new Error(String(error)), 
          operation: 'connect' 
        } 
      })
      throw error // Re-throw to prevent invalid state
    }

    /**
     * @internal
     * Create and return public trigger with event filtering.
     * Only events in publicEvents array can be triggered externally.
     */
    return getPublicTrigger({ 
      trigger, 
      publicEvents: config.publicEvents 
    }) as PlaitedTrigger
  }
}