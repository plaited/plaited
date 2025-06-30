import {
  McpServer,
  type RegisteredPrompt,
  type RegisteredResource,
  type RegisteredResourceTemplate,
  type RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js'
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
  type PlaitedTrigger,
} from '../behavioral.js'

import { useToolRegistry, type ToolRegistry } from './use-tool-registry.js'
import { usePromptRegistry, type PromptRegistry } from './use-prompt-registry.js'
import { useResourceRegistry, type ResourceRegistry } from './use-resource-registry.js'

export const defineMCPServer = <
  A extends EventDetails,
  C extends { [key: string]: unknown } = { [key: string]: unknown },
>({
  toolRegistry,
  promptRegistry,
  resourceRegistry,
  name,
  version,
  ...args
}: {
  name: string
  version: string
  toolRegistry?: ToolRegistry
  resourceRegistry?: ResourceRegistry
  promptRegistry?: PromptRegistry
  bProgram: (
    args: {
      bSync: BSync
      bThread: BThread
      bThreads: BThreads
      disconnect: Disconnect
      server: McpServer
      trigger: PlaitedTrigger
      useSnapshot: UseSnapshot
      prompts?: { [K: string]: RegisteredPrompt }
      resources?: { [K: string]: RegisteredResourceTemplate | RegisteredResource }
      tools?: { [K: string]: RegisteredTool }
    } & C,
  ) => Promise<Handlers<A>>
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

  const prompts = promptRegistry ? usePromptRegistry({ registry: promptRegistry, server, trigger }) : undefined
  const resources = resourceRegistry ? useResourceRegistry({ registry: resourceRegistry, server, trigger }) : undefined
  const tools = toolRegistry ? useToolRegistry({ registry: toolRegistry, server, trigger }) : undefined

  const init = async (ctx: C) => {
    const handlers = await args.bProgram({
      ...ctx,
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
  init.disconnect = () => {
    disconnectSet.forEach((disconnect) => disconnect())
  }
  return init
}
