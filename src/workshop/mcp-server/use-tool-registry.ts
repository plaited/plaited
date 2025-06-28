import { McpServer, type RegisteredTool, type ToolCallback } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { type SignalWithoutInitialValue } from '../../behavioral.js'
import { ueid } from '../../utils.js'
import { useSignal } from '../../behavioral.js'
import { z } from 'zod'

export const mcpPromisesMap = new Map<
  string,
  { reject: (value: unknown) => void; resolve: (result: CallToolResult) => void }
>()

export const createRequestReference = () => ueid('mcp_')

type InputSchemma = Parameters<McpServer['registerTool']>[1]['inputSchema']

type ToolSignalCallback<T extends InputSchemma = InputSchemma> = T

type ToolConfig = Parameters<McpServer['registerTool']>[1]

type ToolSignal<T extends InputSchemma = undefined> = SignalWithoutInitialValue<{
  resolve: ReturnType<typeof Promise.withResolvers<CallToolResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<CallToolResult>>['reject']
  args: T
}>

type ToolRegistry = {
  [k: string]: Parameters<McpServer['registerTool']>[1]
}

type InputArgs<S extends z.ZodRawShape> = S extends z.ZodRawShape ? z.infer<z.ZodObject<S>> : unknown

type UseToolRegstritryReturn<T extends ToolRegistry> = {
  [K in keyof T]: {
    args: T[K] extends { inputSchema: infer S } ? InputArgs<S[]> : unknown
    resolve: ReturnType<typeof Promise.withResolvers<CallToolResult>>['resolve']
    reject: ReturnType<typeof Promise.withResolvers<CallToolResult>>['reject']
  }
}

const registerTool = ({
  server,
  type,
  config,
}: {
  server: McpServer
  type: Parameters<McpServer['registerTool']>[0]
  config: Parameters<McpServer['registerTool']>[1]
}): [ToolSignal<typeof config.inputSchema>, RegisteredTool] => {
  const signal: ToolSignal<typeof config.inputSchema> = useSignal()
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

export const useToolRegistry = <T extends ToolRegistry>(server: McpServer, registry: T) => {
  const target: UseToolRegstritryReturn<T> = {}
  for (const [type, config] of Object.entries(registry)) {
    target[key] = registerTool<
      (typeof config)['inputSchema'] extends { inputSchema: infer S } ?
        S extends z.ZodRawShape ?
          z.infer<z.ZodObject<S>>
        : unknown
      : unknown
    >({ type, config, server })
  }
  return target
}
