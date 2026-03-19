import { createRemoteMcpSession } from 'plaited/mcp'

const MCP_URL = 'https://example.com/mcp'

await using session = await createRemoteMcpSession(MCP_URL, { timeoutMs: 30_000 })
const tools = await session.listTools()
const result = await session.callTool('search', { query: 'test' })

console.log(JSON.stringify({ tools, result }, null, 2))
