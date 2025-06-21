import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

const server = new Server({
  name: 'plaited-workshop',
  version: '1.0.0',
})

const transport = new StdioServerTransport()
await server.connect(transport)
