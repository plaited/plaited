import { McpServer, type RegisteredTool, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { type SignalWithoutInitialValue } from '../../behavioral.js'
import { ueid } from '../../utils.js'
import { useSignal } from '../../behavioral.js'
import type { ZodRawShape } from 'zod'

export const mcpPromisesMap = new Map<
  string,
  { reject: (value: unknown) => void; resolve: (result: CallToolResult) => void }
>()

export const createRequestReference = () => ueid('mcp_')

type ToolSignalCallback<T extends ZodRawShape = ZodRawShape> = ToolCallback<T>

type ToolSignal = SignalWithoutInitialValue<{
  resolve: ReturnType<typeof Promise.withResolvers<CallToolResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<CallToolResult>>['reject']
  args: Parameters<ToolSignalCallback>[0]
}>

type ToolRegistry = {
  [k: string]: Parameters<McpServer['registerTool']>[1]
}

const registerTool = (
  server: McpServer,
  type: Parameters<McpServer['registerTool']>[0],
  config: Parameters<McpServer['registerTool']>[1],
): [ToolSignal, RegisteredTool] => {
  const signal: ToolSignal = useSignal()
  const tool = server.registerTool(type, config, async (args) => {
    const { promise, resolve, reject } = Promise.withResolvers<CallToolResult>()
    signal.set({
      resolve,
      reject,
      args,
    })
    return promise
  })
  return [signal, tool]
}

export const useToolRegistry = (server: McpServer, registry: ToolRegistry) => {
  const target = {}
  for (const [key, value] of Object.entries(registry)) {
    Object.assign(target, {
      [key]: registerTool(server, key, value),
    })
  }
  return target
}
