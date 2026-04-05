import { mcpCallTool } from 'plaited/mcp'

const MCP_URL = 'https://bun.com/docs/mcp'
const TOOL_NAME = 'search_bun'

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
      console.log(content.text)
    }
  }
}

await main()
