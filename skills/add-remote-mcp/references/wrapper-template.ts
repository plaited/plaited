/**
 * Template: MCP search wrapper script.
 *
 * @remarks
 * Copy this file to a new skill's scripts/ directory and customize:
 * 1. Set MCP_URL to the server's endpoint
 * 2. Set TOOL_NAME to the tool to invoke
 * 3. Adjust the input type if the tool takes more than `query`
 * 4. Set AUTH_HEADERS if the server requires authentication
 *
 * Usage: bun run search.ts '{"query": "your search query"}'
 */

import { mcpCallTool } from 'plaited/mcp'

// ---- Customize these ----
const MCP_URL = 'https://example.com/mcp'
const TOOL_NAME = 'SearchExample'

// ---- Auth (delete if not needed) ----
const AUTH_ENV_VAR = '' // e.g., 'MY_SERVICE_API_KEY'
const AUTH_HEADERS: Record<string, string> | undefined =
  AUTH_ENV_VAR && Bun.env[AUTH_ENV_VAR] ? { Authorization: `Bearer ${Bun.env[AUTH_ENV_VAR]}` } : undefined

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

  const input = JSON.parse(raw)
  if (!input.query) {
    console.error('Missing required field: query')
    process.exit(2)
  }

  const result = await mcpCallTool(MCP_URL, TOOL_NAME, input, AUTH_HEADERS ? { headers: AUTH_HEADERS } : undefined)

  for (const content of result.content) {
    if (content.type === 'text' && content.text) {
      // biome-ignore lint/suspicious/noConsole: CLI stdout output
      console.log(content.text)
    }
  }
}

await main()
