import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createMcpSession } from '../../../src/tools/mcp.utils.ts'

const transport = new StreamableHTTPClientTransport(new URL('https://example.com/mcp'))

await using session = await createMcpSession(transport, { timeoutMs: 30_000 })
const tools = await session.listTools()

console.log(JSON.stringify(tools, null, 2))
