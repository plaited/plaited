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

import { join } from 'node:path'

// ---- Customize these ----
const MCP_URL = 'https://example.com/mcp'
const TOOL_NAME = 'SearchExample'

// ---- Auth (delete if not needed) ----
const AUTH_ENV_VAR = '' // e.g., 'MY_SERVICE_API_KEY'
const AUTH_HEADERS: Record<string, string> | undefined =
  AUTH_ENV_VAR && Bun.env[AUTH_ENV_VAR] ? { Authorization: `Bearer ${Bun.env[AUTH_ENV_VAR]}` } : undefined

const createCliCommand = (payload: string) => {
  const plaited = Bun.which('plaited')
  if (plaited) {
    const command = [plaited, 'mcp', 'call', MCP_URL, TOOL_NAME, payload]
    if (AUTH_HEADERS) {
      command.push('--headers', JSON.stringify(AUTH_HEADERS))
    }
    return command
  }

  const command = ['bun', join(import.meta.dir, '../../../src/cli.ts'), 'mcp', 'call', MCP_URL, TOOL_NAME, payload]
  if (AUTH_HEADERS) {
    command.push('--headers', JSON.stringify(AUTH_HEADERS))
  }
  return command
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

  const input = JSON.parse(raw)
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
