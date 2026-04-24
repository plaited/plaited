/**
 * Template: one-shot MCP tool wrapper.
 *
 * Copy this file into a new skill's scripts/ directory, set the constants, and pass any JSON
 * object that matches the target MCP tool schema.
 *
 * Usage:
 *   bun run tool.ts '{"topic":"auth","limit":5}'
 */

import { mcpCallTool } from 'plaited/mcp'

const MCP_URL = 'https://example.com/mcp'
const TOOL_NAME = 'example_tool'

const parseToolArguments = (raw: string | undefined) => {
  if (raw === '--help' || raw === '-h' || !raw) {
    console.error(`Usage: bun run tool.ts '{"key":"value"}'`)
    process.exit(raw ? 0 : 2)
  }

  const parsed = JSON.parse(raw) as unknown
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') {
    throw new Error('Expected a JSON object matching the MCP tool input schema')
  }

  return parsed as Record<string, unknown>
}

const main = async () => {
  const result = await mcpCallTool(MCP_URL, TOOL_NAME, parseToolArguments(Bun.argv[2]))

  console.log(JSON.stringify(result, null, 2))
}

await main()
