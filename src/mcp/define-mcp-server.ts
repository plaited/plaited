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
  getPlaitedTrigger,
  type PlaitedTrigger,
} from '../behavioral.js'

import type { Registry, PrimitiveHandlers, Resources, Prompts, Tools } from './mcp.types.js'
import { registerPrompt, registerResource, registerTool } from './mcp.utils.js'

export const defineMCPServer = async <R extends Registry, E extends EventDetails>({
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
  const server = new McpServer({
    name,
    version,
  })

  const { trigger: _trigger, useFeedback, ...rest } = bProgram()

  const disconnectSet = new Set<Disconnect>()
  const disconnect = () => {
    disconnectSet.forEach((disconnect) => disconnect())
  }
  const trigger = getPlaitedTrigger(_trigger, disconnectSet)
  const tools = {} as Tools<R>
  const prompts = {} as Prompts<R>
  const resources = {} as Resources<R>
  for (const [name, { primitive, config }] of Object.entries(registry)) {
    primitive === 'tool' && Object.assign(tools, { [name]: registerTool({ server, name, config, trigger }) })
    primitive === 'prompt' && Object.assign(prompts, { [name]: registerPrompt({ server, name, config, trigger }) })
    primitive === 'resource' &&
      Object.assign(resources, { [name]: registerResource({ server, name, trigger, config }) })
  }
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
  useFeedback(handlers)
  return server
}
