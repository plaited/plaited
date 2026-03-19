import { join } from 'node:path'

const MCP_URL = 'https://agentclientprotocol.com/mcp'
const TOOL_NAME = 'search_agent_client_protocol'

const createCliCommand = (payload: string) => {
  const plaited = Bun.which('plaited')
  if (plaited) {
    return [plaited, 'mcp', 'call', MCP_URL, TOOL_NAME, payload]
  }

  return ['bun', join(import.meta.dir, '../../../src/cli.ts'), 'mcp', 'call', MCP_URL, TOOL_NAME, payload]
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

  const proc = Bun.spawn(createCliCommand(JSON.stringify(input)), {
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [exitCode, stdout, stderr] = await Promise.all([
    proc.exited,
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
  ])

  if (exitCode !== 0) {
    console.error(stderr || stdout || 'plaited mcp call failed')
    process.exit(exitCode)
  }

  const result = JSON.parse(stdout) as { content?: Array<{ type: string; text?: string }> }

  for (const content of result.content ?? []) {
    if (content.type === 'text' && content.text) {
      // biome-ignore lint/suspicious/noConsole: CLI stdout output
      console.log(content.text)
    }
  }
}

await main()
