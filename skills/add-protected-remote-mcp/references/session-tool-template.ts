/**
 * Template: session-based MCP tool wrapper.
 *
 * Reuse one MCP connection when you expect repeated tool calls or want an explicit session
 * lifecycle around a generic JSON tool invocation.
 *
 * Usage:
 *   bun run session-tool.ts '{"task":"summarize","format":"json"}'
 */

import { createRemoteMcpSession } from 'plaited/mcp'

const MCP_URL = 'https://example.com/mcp'
const TOOL_NAME = 'example_tool'
const TIMEOUT_MS = 30_000

const parseToolArguments = (raw: string | undefined) => {
  if (raw === '--help' || raw === '-h' || !raw) {
    console.error(`Usage: bun run session-tool.ts '{"key":"value"}'`)
    process.exit(raw ? 0 : 2)
  }

  const parsed = JSON.parse(raw) as unknown
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Expected a JSON object matching the MCP tool input schema')
  }

  return parsed as Record<string, unknown>
}

const main = async () => {
  await using session = await createRemoteMcpSession(MCP_URL, { timeoutMs: TIMEOUT_MS })
  const result = await session.callTool(TOOL_NAME, parseToolArguments(Bun.argv[2]))

  console.log(JSON.stringify(result, null, 2))
}

await main()
