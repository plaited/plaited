/**
 * Search the Model Context Protocol specification via MCP.
 *
 * Usage: bun run search.ts '{"query": "tools/call request format"}'
 */

import { mcpCallTool } from 'plaited'

const MCP_URL = 'https://modelcontextprotocol.io/mcp'
const TOOL_NAME = 'SearchModelContextProtocol'

type SearchInput = {
  query: string
  version?: string
}

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

  const input = JSON.parse(raw) as SearchInput
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
