import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { mcpConnect } from '../../../src/tools/mcp.utils.ts'

const transport = new StreamableHTTPClientTransport(new URL('https://example.com/mcp'))
const client = await mcpConnect(transport)

try {
  const { tools } = await client.listTools()
  console.log(JSON.stringify(tools, null, 2))
} finally {
  await client.close()
}
