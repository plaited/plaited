import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import {
  bThread,
  bSync,
  type EventDetails,
  behavioral,
  getPlaitedTrigger,
  type PlaitedTrigger,
  getPublicTrigger,
  useSignal,
  type Disconnect,
} from '../behavioral.js'

import type { MCPClientConfig, ServerTransportConfigs } from './mcp.types.js'
import { createTransport, createDiscoverySignals } from './mcp.utils.js'
import { createDefaultThreads, createDefaultHandlers } from './mcp-client-threads.js'

export const defineMCPClient = async <E extends EventDetails = EventDetails>({
  servers,
  name,
  version,
}: {
  name: string
  servers: ServerTransportConfigs
  version: string
}) => {
  const client = new Client({
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

  const { tools, prompts, reosurces } = registerServers({ client, trigger, servers })

  /**
   * @internal
   * Create reactive signals for tracking MCP server capabilities.
   * These signals enable reactive UI updates and state management.
   */
  const capabilities = useSignal<unknown>({})
  const { tools, resources, prompts } = createDiscoverySignals(client, trigger)

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
          operation: 'disconnect',
        },
      })
    }
    disconnectSet.forEach((cb) => cb())
  }
  disconnectSet.add(disconnect)

  /**
   * @internal
   * Create default threads if enabled.
   * These provide common agent behaviors out of the box.
   */
  if (config.defaultThreads) {
    createDefaultThreads({
      bThread,
      bThreads: rest.bThreads,
      bSync,
      trigger,
      inferenceEngine: config.inferenceEngine,
    })
  }

  /**
   * @internal
   * Get default handlers if inference engine is provided.
   * These implement core agent functionality.
   */
  const defaultHandlers =
    config.inferenceEngine || config.defaultThreads ?
      createDefaultHandlers({
        client,
        inferenceEngine: config.inferenceEngine,
        tools,
        resources,
        prompts,
        trigger,
      })
    : {}

  /**
   * @internal
   * Execute user's bProgram to get event handlers.
   * Provides full behavioral programming context plus MCP-specific utilities.
   */
  const userHandlers =
    config.bProgram ?
      await config.bProgram({
        bSync,
        bThread,
        disconnect,
        trigger,
        client,
        inferenceEngine: config.inferenceEngine,
        capabilities,
        tools,
        resources,
        prompts,
        ...rest,
      })
    : {}

  /**
   * @internal
   * Merge default handlers with user handlers.
   * User handlers take precedence over defaults.
   */
  const handlers = { ...defaultHandlers, ...userHandlers }

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
      detail: { capabilities: serverCapabilities || {} },
    })
  } catch (error) {
    trigger({
      type: 'CLIENT_ERROR',
      detail: {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'connect',
      },
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
    publicEvents: [
      ...(config.publicEvents || []),
      // Always include agent events if inference engine is present
      ...(config.inferenceEngine ? ['CHAT', 'THINK', 'PLAN'] : []),
    ],
  }) as PlaitedTrigger
}
