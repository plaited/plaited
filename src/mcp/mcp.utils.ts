import {
  McpServer,
  type RegisteredPrompt,
  type RegisteredResource,
  type RegisteredResourceTemplate,
  type ReadResourceCallback,
  type ReadResourceTemplateCallback,
  type ResourceTemplate,
  type ResourceMetadata,
  type RegisteredTool,
} from '@modelcontextprotocol/sdk/server/mcp.js'
import type { GetPromptResult, ReadResourceResult, CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { type PlaitedTrigger, type SignalWithoutInitialValue, useSignal } from '../behavioral.js'
import { z } from 'zod'

type RegistrySignal<R, T> = SignalWithoutInitialValue<{
  resolve: ReturnType<typeof Promise.withResolvers<R>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<R>>['reject']
  args?: T
}>

type PromptArgsRawShape = Exclude<Parameters<McpServer['registerPrompt']>[1]['argsSchema'], undefined>

export const registerPrompt = ({
  server,
  name,
  config,
  trigger,
}: {
  server: McpServer
  name: Parameters<McpServer['registerPrompt']>[0]
  config: Parameters<McpServer['registerPrompt']>[1]
  trigger: PlaitedTrigger
}): RegisteredPrompt => {
  const signal: RegistrySignal<GetPromptResult, Parameters<McpServer['registerPrompt']>[1]['argsSchema']> = useSignal()
  const prompt = server.registerPrompt<PromptArgsRawShape>(name, config, async (...args) => {
    const { promise, resolve, reject } = Promise.withResolvers<GetPromptResult>()
    signal.set({
      resolve,
      reject,
      args: args as unknown as PromptArgsRawShape,
    })
    return promise
  })
  signal.listen(name, trigger)
  return prompt
}

export const registerResource = ({
  server,
  name,
  config,
  trigger,
}: {
  server: McpServer
  name: string
  config: {
    uriOrTemplate: string | ResourceTemplate
    metaData: ResourceMetadata
  }
  trigger: PlaitedTrigger
}): RegisteredResourceTemplate | RegisteredResource => {
  const signal: RegistrySignal<
    ReadResourceResult,
    typeof config.uriOrTemplate extends ResourceTemplate ? Parameters<ReadResourceTemplateCallback>
    : Parameters<ReadResourceCallback>
  > = useSignal()
  const callback: typeof config.uriOrTemplate extends ResourceTemplate ? ReadResourceTemplateCallback
  : ReadResourceCallback = async (...args) => {
    const { promise, resolve, reject } = Promise.withResolvers<ReadResourceResult>()
    signal.set({
      resolve,
      reject,
      args,
    })
    return promise
  }
  const resource = server.registerResource(name, config.uriOrTemplate, config.metaData, callback)
  signal.listen(name, trigger)
  return resource
}

export const registerTool = ({
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
  const signal: RegistrySignal<CallToolResult, z.ZodRawShape> = useSignal()
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
