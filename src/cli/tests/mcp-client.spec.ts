import { describe, expect, test } from 'bun:test'

const MCP_DOCS_URL = 'https://modelcontextprotocol.io/mcp'

const spawnMcpClient = (input: string, ...extraArgs: string[]) =>
  Bun.spawn(
    [
      'bun',
      '-e',
      [
        "import { mcpClientCli } from '../mcp-client.ts'",
        `await mcpClientCli['mcp-client']([${[JSON.stringify(input), ...extraArgs.map((a) => JSON.stringify(a))].join(',')}])`,
      ].join(';\n'),
    ],
    { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
  )

describe('mcpClientCli', () => {
  test('--help exits 0 and describes all seven modes', async () => {
    const proc = await spawnMcpClient('', '--help')

    expect(await proc.exited).toBe(0)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain('call-tool')
    expect(stderr).toContain('list-tools')
    expect(stderr).toContain('list-prompts')
    expect(stderr).toContain('get-prompt')
    expect(stderr).toContain('list-resources')
    expect(stderr).toContain('read-resource')
    expect(stderr).toContain('discover')
  })

  test('list-tools mode returns tools from mcp-docs server', async () => {
    const proc = await spawnMcpClient(
      JSON.stringify({
        mode: 'list-tools',
        url: MCP_DOCS_URL,
      }),
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.mode).toBe('list-tools')
    expect(Array.isArray(output.result)).toBe(true)
    expect(output.result.length).toBeGreaterThan(0)
    const searchTool = output.result.find((t: { name: string }) => t.name === 'search_model_context_protocol')
    expect(searchTool).toBeDefined()
    expect(searchTool.description).toBeDefined()
  })

  test('call-tool mode searches mcp-docs and returns text results', async () => {
    const proc = await spawnMcpClient(
      JSON.stringify({
        mode: 'call-tool',
        url: MCP_DOCS_URL,
        tool: 'search_model_context_protocol',
        args: { query: 'MCP tools/call' },
      }),
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.mode).toBe('call-tool')
    expect(output.result.content.length).toBeGreaterThan(0)
    expect(output.result.content[0].type).toBe('text')
  })

  test('list-prompts mode returns prompts from mcp-docs server', async () => {
    const proc = await spawnMcpClient(
      JSON.stringify({
        mode: 'list-prompts',
        url: MCP_DOCS_URL,
      }),
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.mode).toBe('list-prompts')
    expect(Array.isArray(output.result)).toBe(true)
  })

  test('list-resources mode returns resources from mcp-docs server', async () => {
    const proc = await spawnMcpClient(
      JSON.stringify({
        mode: 'list-resources',
        url: MCP_DOCS_URL,
      }),
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.mode).toBe('list-resources')
    expect(Array.isArray(output.result)).toBe(true)
  })

  test('read-resource mode reads a resource from mcp-docs server', async () => {
    const proc = await spawnMcpClient(
      JSON.stringify({
        mode: 'read-resource',
        url: MCP_DOCS_URL,
        uri: 'mintlify://skills/draft-sep',
      }),
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.mode).toBe('read-resource')
    expect(Array.isArray(output.result)).toBe(true)
    expect(output.result.length).toBeGreaterThan(0)
    expect(output.result[0].text).toBeDefined()
  })

  test('discover mode returns all capabilities from mcp-docs server', async () => {
    const proc = await spawnMcpClient(
      JSON.stringify({
        mode: 'discover',
        url: MCP_DOCS_URL,
      }),
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.mode).toBe('discover')
    expect(output.result.tools.length).toBeGreaterThan(0)
    expect(Array.isArray(output.result.prompts)).toBe(true)
    expect(Array.isArray(output.result.resources)).toBe(true)
  })

  test('rejects missing url field', async () => {
    const proc = await spawnMcpClient(
      JSON.stringify({
        mode: 'list-tools',
      }),
    )

    expect(await proc.exited).toBeGreaterThan(0)
  })

  test('rejects invalid mode', async () => {
    const proc = await spawnMcpClient(
      JSON.stringify({
        mode: 'invalid-mode',
        url: MCP_DOCS_URL,
      }),
    )

    expect(await proc.exited).toBeGreaterThan(0)
  })

  test('rejects non-JSON input', async () => {
    const proc = await spawnMcpClient('not-json')

    expect(await proc.exited).toBeGreaterThan(0)
  })

  test('call-tool mode rejects missing tool name', async () => {
    const proc = await spawnMcpClient(
      JSON.stringify({
        mode: 'call-tool',
        url: MCP_DOCS_URL,
        args: { query: 'test' },
      }),
    )

    expect(await proc.exited).toBeGreaterThan(0)
  })

  test('--dry-run prints request details without executing', async () => {
    const proc = await spawnMcpClient(
      JSON.stringify({
        mode: 'call-tool',
        url: MCP_DOCS_URL,
        tool: 'search_model_context_protocol',
        args: { query: 'test' },
      }),
      '--dry-run',
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.command).toBe('mcp-client')
    expect(output.dryRun).toBe(true)
    expect(output.input.mode).toBe('call-tool')
  })

  test('--schema input emits JSON Schema and exits 0', async () => {
    const proc = await spawnMcpClient('', '--schema', 'input')

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.oneOf).toBeDefined()
    expect(output.oneOf.length).toBe(7)
    expect(output.oneOf[0].properties.mode.const).toBe('call-tool')
    expect(output.description).toContain('MCP client')
  })

  test('--schema output emits output schema and exits 0', async () => {
    const proc = await spawnMcpClient('', '--schema', 'output')

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.oneOf).toBeDefined()
    expect(output.oneOf.length).toBe(7)
    expect(output.oneOf[0].properties.mode.const).toBe('call-tool')
  })
})
