import type { McpServer } from '@modelcontextprotocol/server'

type UseServerCallback = (server: McpServer) => void

export const useMCPServer = (cb: UseServerCallback) => (server: McpServer) => cb(server)
