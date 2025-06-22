import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { mcpServer } from '../mcp-server.js'

const server = await mcpServer
const transport = new StdioServerTransport()
await server.connect(transport)
