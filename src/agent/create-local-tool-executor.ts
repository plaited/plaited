import type { CreateLocalExecutorOptions, ToolExecutor } from './agent.types.ts'
import { agentCrudHandlers } from './crud.ts'

export const createLocalToolExecutor = ({
  cwd,
  env = {},
  handlers = agentCrudHandlers,
}: CreateLocalExecutorOptions): ToolExecutor => {
  return async (toolCall, signal) => {
    const handler = handlers[toolCall.name]
    if (!handler) {
      throw new Error(`No local tool handler registered for '${toolCall.name}'`)
    }

    return handler(toolCall.arguments, {
      workspace: cwd,
      env,
      signal,
    })
  }
}
