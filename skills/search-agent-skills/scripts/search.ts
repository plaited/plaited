/**
 * Search the AgentSkills specification via MCP.
 *
 * Usage: bun run search.ts '{"query": "SKILL.md frontmatter fields"}'
 */

import { mcpCallTool } from 'plaited'

const MCP_URL = 'https://agentskills.io/mcp'
const TOOL_NAME = 'SearchAgentSkills'

type SearchInput = {
  query: string
}

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

  const result = await mcpCallTool(MCP_URL, TOOL_NAME, input)
  for (const content of result.content) {
    if (content.type === 'text' && content.text) {
      // biome-ignore lint/suspicious/noConsole: CLI stdout output
      console.log(content.text)
    }
  }
}

await main()
