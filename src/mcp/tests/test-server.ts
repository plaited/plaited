import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { mcpServer } from '../mcp-server.js'

const server = await mcpServer({
  root: `${process.cwd()}/src`,
})
const transport = new StdioServerTransport()
await server.connect(transport)
