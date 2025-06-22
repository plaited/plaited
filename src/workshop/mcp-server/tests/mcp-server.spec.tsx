import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { PUBLIC_EVENTS } from '../mcp-server.constants'

const transport = new StdioClientTransport({
  command: 'bun',
  args: [`${import.meta.dir}/test-server.ts`],
})

const client = new Client({
  name: 'example-client',
  version: '1.0.0',
})

await client.connect(transport)

const result = await client.callTool({
  name: PUBLIC_EVENTS.start_workshop,
  arguments: {
    root: `${process.cwd()}/src`,
  },
})

console.log(result)
