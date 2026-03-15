/**
 * Search the Model Context Protocol specification via MCP.
 *
 * Usage: bun run search.ts '{"query": "tools/call request format"}'
 */

import { mcpCallTool } from '../../add-remote-mcp/scripts/remote-mcp.ts'

const MCP_URL = 'https://modelcontextprotocol.io/mcp'
const TOOL_NAME = 'search_model_context_protocol'

const main = async () => {
  const raw = process.argv[2]

  if (raw === '--help' || raw === '-h') {
    console.error(`Usage: bun run search.ts '{"query": "...", "version": "v0.7"}'`)
    process.exit(0)
  }

  if (!raw) {
    console.error(`Usage: bun run search.ts '{"query": "..."}'`)
    process.exit(2)
  }

  let input: { query?: string }
  try {
    input = JSON.parse(raw)
  } catch {
    console.error('Invalid JSON input')
    process.exit(2)
  }
  if (!input.query) {
    console.error('Missing required field: query')
    process.exit(2)
  }

  const result = await mcpCallTool(MCP_URL, TOOL_NAME, input)

  for (const content of result.content) {
    if (content.type === 'text' && content.text) {
      // biome-ignore lint/suspicious/noConsole: CLI stdout output
      console.log(content.text)
    }
  }
}

await main()
