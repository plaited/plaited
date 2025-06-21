import { type ServerResult } from '@modelcontextprotocol/sdk/types.js'
import { ueid } from '../plaited/src/utils.js'
import type { Trigger } from 'plaited/behavioral'

export const mcpPromisesMap = new Map<
  string,
  { reject: (value: unknown) => void; resolve: (result: ServerResult) => void }
>()

export const createRequestId = () => ueid('mcp_')

export const getMCPTrigger = (args: { trigger: Trigger; publicEvents?: string[] | ReadonlyArray<string> }) => {
  const observed = new Set(args?.publicEvents || [])
  const trigger: Trigger = ({ type, detail }) => {
    if (observed.has(type)) return args.trigger?.({ type: type, detail: detail })
    if (type) throw new Error(`Not observing trigger [${type}]`)
  }
  return trigger
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
  resolve: (result: ServerResult) => void
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
