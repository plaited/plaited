import { Client, type ClientOptions } from '@modelcontextprotocol/sdk/client/index.js'
// import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
// import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {
  behavioral,
  getPlaitedTrigger,
  bSync,
  bThread,
  type Handlers,
  type BSync,
  type BThreads,
  type BThread,
  type Disconnect,
  type EventDetails,
  type PlaitedTrigger,
  // type SignalWithoutInitialValue,
  type UseSnapshot,
} from '../behavioral.js'
import type { ServerTransportConfigs } from './ai.types.js'
// import { CLIENT_ERROR_EVENTS } from './mcp.constants.js'

// const createTransport = (config: ServerTransportConfigs[string]) => {
//   if (config.type === 'stdio') {
//     return new StdioClientTransport({
//       command: config.command,
//       args: config.args,
//       env: config.env,
//     })
//   } else {
//     return new StreamableHTTPClientTransport(new URL(config.url), config.options)
//   }
// }

// export const registerClient = async ({
//   name,
//   version,
//   trigger,
//   serverConfig,
//   options,
//   title,
// }: {
//   name: string
//   version: string
//   trigger: PlaitedTrigger
//   serverConfig: ServerTransportConfigs[string]
//   options?: ClientOptions
//   title?: string
// }) => {
//   try {
//     await client.connect(transport)
//     return client
//   } catch (error) {
//     trigger({ type: CLIENT_ERROR_EVENTS.ERROR_REGISTERING_CLIENT, detail: error })
//   }
// }

export const bClient = async <E extends EventDetails>({
  name,
  version,
  // serverConfig,
  options,
  title,
  bProgram,
  // publicEvents = [],
}: {
  name: string
  version: string
  serverConfig: ServerTransportConfigs[string]
  options?: ClientOptions
  title?: string
  publicEvents?: string[]
  bProgram: (args: {
    bSync: BSync
    bThread: BThread
    bThreads: BThreads
    client: Client
    disconnect: Disconnect
    trigger: PlaitedTrigger
    useSnapshot: UseSnapshot
  }) => Promise<Handlers<E>>
}) => {
  const client = new Client(
    {
      name,
      version,
      title,
    },
    options,
  )
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
}
