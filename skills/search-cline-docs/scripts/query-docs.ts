import { mcpCallTool } from 'plaited/mcp'

const MCP_URL = 'https://docs.cline.bot/mcp'
const TOOL_NAME = 'query_docs_filesystem_cline'

const main = async () => {
  const raw = process.argv[2]

  if (raw === '--help' || raw === '-h') {
    console.error(`Usage: bun run query-docs.ts '{"command": "head -120 /mcp/mcp-overview.mdx"}'`)
    process.exit(0)
  }

  if (!raw) {
    console.error(`Usage: bun run query-docs.ts '{"command": "..."}'`)
    process.exit(2)
  }

  let input: { command?: string }
  try {
    input = JSON.parse(raw)
  } catch {
    console.error('Invalid JSON input')
    process.exit(2)
  }

  if (!input.command) {
    console.error('Missing required field: command')
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
