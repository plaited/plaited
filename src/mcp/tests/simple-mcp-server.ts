import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { bServer } from 'plaited/mcp'
import { registry } from './simple-mcp-server.registry.js'

const transport = new StdioServerTransport()
const init = bServer({
  serverInfo: {
    name: 'test-server',
    version: '0.0.1',
  },
  registry,
})

await init(transport)
