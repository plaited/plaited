import { createRemoteMcpSession } from 'plaited/mcp'

// Live transport endpoint only. If you were given a discovery URL such as
// https://bun.com/docs/mcp, use mcpDiscover/mcpListTools first and locate the
// server's transport endpoint before creating a session.
const MCP_URL = 'https://example.com/mcp'

await using session = await createRemoteMcpSession(MCP_URL, { timeoutMs: 30_000 })
const tools = await session.listTools()
const result = await session.callTool('search', { query: 'test' })

console.log(JSON.stringify({ tools, result }, null, 2))
