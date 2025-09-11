import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import {
  behavioral,
  getPlaitedTrigger,
  bSync,
  bThread,
  getPublicTrigger,
  type Disconnect,
  type EventDetails,
} from '../behavioral.js'
import type { BClientParams } from './mcp.types.js'

export const bClient = async <E extends EventDetails>({
  options,
  bProgram,
  publicEvents = [],
  clientInfo,
  transport,
}: BClientParams<E>) => {
  const client = new Client(clientInfo, options)
  // const transport = createTransport(serverConfig)

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
   * Master disconnect function that cleans up all resources.
   * Runs all accumulated cleanup callbacks then closes the MCP server.
   * Note: server.close() is async but disconnect callbacks are sync.
   */
  const disconnect = async () => {
    disconnectSet.forEach((disconnect) => void disconnect())
    await client.close()
  }

  /**
   * @internal
   * Execute user's bProgram to get event handlers.
   * Provides full behavioral programming context plus MCP-specific utilities.
   * Await supports async initialization (e.g., database connections).
   */
  const handlers = await bProgram({
    bSync,
    bThread,
    disconnect,
    client,
    trigger,
    ...rest,
  })

  /**
   * @internal
   * Connect handlers to the behavioral program's feedback loop.
   * This completes the event flow: MCP → signals → triggers → handlers.
   */
  useFeedback(handlers)
  await client.connect(transport)
  return {
    trigger: getPublicTrigger({ trigger: _trigger, publicEvents }),
    client,
  }
}
