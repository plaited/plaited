import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import {
  type BSync,
  type BThread,
  bThread,
  bSync,
  type EventDetails,
  type UseSnapshot,
  type BThreads,
  bProgram,
  type Disconnect,
  type Handlers,
  getPlaitedTrigger,
  getPublicTrigger,
  type PlaitedTrigger,
} from '../../behavioral.js'

import { useRegisterTool } from './mcp-server.utils.js'

export const defineMCPServer = async <A extends EventDetails>(args: {
  name: string
  version: string
  publicEvents: string[]
  bProgram: (args: {
    bSync: BSync
    bThread: BThread
    bThreads: BThreads
    disconnect: Disconnect
    trigger: PlaitedTrigger
    useSnapshot: UseSnapshot
    registerTool: ReturnType<typeof useRegisterTool>
  }) => Promise<Handlers<A>>
}) => {
  const server = new McpServer({
    name: args.name,
    version: args.version,
  })
  const { trigger, useFeedback, ...rest } = bProgram()
  const disconnectSet = new Set<Disconnect>()
  const disconnect = () => {
    disconnectSet.forEach((disconnect) => disconnect())
  }

  const registerTool = useRegisterTool({ trigger, publicEvents: args.publicEvents, server })

  const handlers = await args.bProgram({
    bSync,
    bThread,
    disconnect,
    trigger: getPlaitedTrigger(trigger, disconnectSet),
    registerTool,
    ...rest,
  })
  useFeedback(handlers)
  getPublicTrigger({ trigger, publicEvents: args?.publicEvents })
  return server
}
