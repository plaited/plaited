import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { CallToolRequestSchema, type ServerResult } from '@modelcontextprotocol/sdk/types.js'
import type { Trigger } from '../../behavioral.js'
import { createRequestId, mcpPromisesMap } from './mcp.utils.js'

export const useToolBridge = ({ server, trigger }: { server: Server; trigger: Trigger }) => {
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name: toolName, arguments: params } = request.params

    return new Promise((resolve: (value: ServerResult) => void, reject: (reason?: unknown) => void) => {
      const requestId = createRequestId()
      mcpPromisesMap.set(requestId, { resolve, reject })
      trigger({
        type: toolName,
        detail: { params, requestId },
      })
    })
  })

  return server
}
