/**
 * Search the AgentSkills specification via MCP.
 *
 * Usage: bun run search.ts '{"query": "SKILL.md frontmatter fields"}'
 */

const MCP_URL = 'https://agentskills.io/mcp'
const TOOL_NAME = 'search_agent_skills'

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
