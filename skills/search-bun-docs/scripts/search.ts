/**
 * Search the Bun documentation via MCP.
 *
 * Usage: bun run search.ts '{"query": "Bun.file API"}'
 */

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

  const result = await Bun.$`plaited remote-mcp-client ${JSON.stringify({
    url: MCP_URL,
    method: 'call-tool',
    toolName: TOOL_NAME,
    arguments: input,
  })}`.json()

  for (const content of result.content) {
    if (content.type === 'text' && content.text) {
      // biome-ignore lint/suspicious/noConsole: CLI stdout output
      console.log(content.text)
    }
  }
}

await main()
