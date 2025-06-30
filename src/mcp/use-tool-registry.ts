import { McpServer, type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { type PlaitedTrigger, type SignalWithoutInitialValue, useSignal } from '../behavioral.js'
import { z } from 'zod'

type ToolSignal<T> = SignalWithoutInitialValue<{
  resolve: ReturnType<typeof Promise.withResolvers<CallToolResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<CallToolResult>>['reject']
  args: T
}>

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
  const signal: ToolSignal<z.ZodRawShape> = useSignal()
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

export type ToolRegistry = {
  [k: string]: Parameters<McpServer['registerTool']>[1]
}

export const useToolRegistry = <T extends ToolRegistry>({
  server,
  registry,
  trigger,
}: {
  server: McpServer
  registry: T
  trigger: PlaitedTrigger
}) =>
  Object.entries(registry).reduce(
    (acc, [name, config]) => {
      return { ...acc, [name]: registerTool({ server, name, config, trigger }) }
    },
    {} as { [K in keyof T]: RegisteredTool },
  )
