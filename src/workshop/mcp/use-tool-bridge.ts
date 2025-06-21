import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, type ServerResult } from '@modelcontextprotocol/sdk/types.js'
import type { Trigger } from '../../behavioral.js'
import { createRequestId, getMCPTrigger, mcpPromisesMap } from './mcp.utils.js'

export const useToolBridge = ({
  server,
  trigger,
  publicEvents,
}: {
  server: Server
  trigger: Trigger
  publicEvents?: string[]
}) => {
  const mcpTrigger = getMCPTrigger({ trigger, publicEvents })
  server.setRequestHandler(CallToolRequestSchema, (request) => {
    const { name: type, arguments: params } = request.params
    const { promise, resolve, reject } = Promise.withResolvers<ServerResult>()
    const requestId = createRequestId()
    mcpPromisesMap.set(requestId, { resolve, reject })
    mcpTrigger({
      type,
      detail: { params, requestId },
    })
    return promise
  })
  return server
}
