import { McpServer, type RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js'
import { type CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { type Trigger, getPublicTrigger } from '../../behavioral.js'
import { ueid } from '../../utils.js'

export const mcpPromisesMap = new Map<
  string,
  { reject: (value: unknown) => void; resolve: (result: CallToolResult) => void }
>()

export const createRequestReference = () => ueid('mcp_')

export const useRegisterTool =
  ({ trigger, server, publicEvents }: { trigger: Trigger; server: McpServer; publicEvents: string[] }) =>
  (
    type: Parameters<McpServer['registerTool']>[0],
    config: Parameters<McpServer['registerTool']>[1],
  ): [string, RegisteredTool] => {
    const tool = server.registerTool(type, config, async (input) => {
      const { promise, resolve, reject } = Promise.withResolvers<CallToolResult>()
      const ref = createRequestReference()
      mcpPromisesMap.set(ref, { resolve, reject })
      getPublicTrigger({ trigger, publicEvents })({
        type,
        detail: { input, ref },
      })
      return promise
    })
    return [type, tool]
  }

export const resolveMCPRequest = ({
  requestId,
  error,
  data,
}: {
  requestId: string
  error?: string
  data?: unknown
}) => {
  const resolvers = mcpPromisesMap.get(requestId)
  if (resolvers) {
    const { reject, resolve } = resolvers
    error ?
      reject(new Error(error))
    : resolve({
        content: [
          {
            type: 'text',
            text: JSON.stringify(data, null, 2),
          },
        ],
      })
    mcpPromisesMap.delete(requestId)
  }
}

// Store a promise for an MCP request idea with timeout???
export const storeMCPPromise = ({
  requestId,
  reject,
  resolve,
}: {
  requestId: string
  reject: (value: unknown) => void
  resolve: (result: CallToolResult) => void
}) => {
  mcpPromisesMap.set(requestId, { resolve, reject })

  // Set up timeout for requests (30 seconds)
  setTimeout(() => {
    if (mcpPromisesMap.has(requestId)) {
      mcpPromisesMap.delete(requestId)
      reject(new Error(`MCP request timeout for request: ${requestId}`))
    }
  }, 30000)
}
