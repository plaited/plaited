import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { bServer } from 'plaited/ai'
import { registry } from './simple-mcp-server.registry.js'

const server = await bServer({
  name: 'test-server',
  version: '0.0.1',
  registry,
})
const transport = new StdioServerTransport()
await server.connect(transport)
