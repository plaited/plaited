import { McpServer, type RegisteredPrompt } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type GetPromptResult } from '@modelcontextprotocol/sdk/types.js'
import { type PlaitedTrigger, type SignalWithoutInitialValue, useSignal } from '../behavioral.js'

type PromptArgsRawShape = Exclude<Parameters<McpServer['registerPrompt']>[1]['argsSchema'], undefined>

type PromptSignal<T> = SignalWithoutInitialValue<{
  resolve: ReturnType<typeof Promise.withResolvers<GetPromptResult>>['resolve']
  reject: ReturnType<typeof Promise.withResolvers<GetPromptResult>>['reject']
  args?: T
}>

const registerPrompt = ({
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
  const signal: PromptSignal<Parameters<McpServer['registerPrompt']>[1]['argsSchema']> = useSignal()
  const prompt = server.registerPrompt<PromptArgsRawShape>(name, config, async (args) => {
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

export type PromptRegistry = {
  [k: string]: Parameters<McpServer['registerPrompt']>[1]
}

export const usePromptRegistry = <T extends PromptRegistry>({
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
      return { ...acc, [name]: registerPrompt({ server, name, config, trigger }) }
    },
    {} as { [K in keyof T]: RegisteredPrompt },
  )
