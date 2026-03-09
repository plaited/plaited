/**
 * Template: MCP search wrapper script.
 *
 * @remarks
 * Copy this file to a new skill's scripts/ directory and customize:
 * 1. Set MCP_URL to the server's endpoint
 * 2. Set TOOL_NAME to the tool to invoke
 * 3. Adjust the input type if the tool takes more than `query`
 * 4. Set AUTH_ENV_VAR if the server requires authentication
 *
 * Usage: bun run search.ts '{"query": "your search query"}'
 */

import type { McpTransportOptions } from 'plaited'
import { mcpCallTool } from 'plaited'

// ---- Customize these ----
const MCP_URL = 'https://example.com/mcp'
const TOOL_NAME = 'SearchExample'

// ---- Auth (delete if not needed) ----
const AUTH_ENV_VAR = '' // e.g., 'MY_SERVICE_API_KEY'
const AUTH: McpTransportOptions | undefined =
  AUTH_ENV_VAR && process.env[AUTH_ENV_VAR]
    ? { headers: { Authorization: `Bearer ${process.env[AUTH_ENV_VAR]}` } }
    : undefined

// ---- Input ----

type SearchInput = {
  query: string
}

// ---- Main ----

const main = async () => {
  const raw = process.argv[2]

  if (raw === '--help' || raw === '-h') {
    console.error(`Usage: bun run search.ts '{"query": "..."}'`)
    process.exit(0)
  }

  if (!raw) {
    console.error(`Usage: bun run search.ts '{"query": "..."}'`)
    process.exit(2)
  }

  const input = JSON.parse(raw) as SearchInput
  if (!input.query) {
    console.error('Missing required field: query')
    process.exit(2)
  }

  const result = await mcpCallTool(MCP_URL, TOOL_NAME, input, AUTH)
  for (const content of result.content) {
    if (content.type === 'text' && content.text) {
      // biome-ignore lint/suspicious/noConsole: CLI stdout output
      console.log(content.text)
    }
  }
}

await main()
