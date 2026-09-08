import { describe, expect, test } from 'bun:test'
import { createConnectionPool } from '../../kernel/kernel.ts'
import { createMcpClientTool, McpClientInputSchema, McpClientOutputSchema } from '../mcp-client.ts'
import { ajv } from '../use-tool.ts'
import { startMcpServer } from './mcp-server-fixture.ts'

const validateInput = ajv.compile(McpClientInputSchema)
const validateOutput = ajv.compile(McpClientOutputSchema)

describe('mcp-client tool — schema contract (RED)', () => {
  test('input schema is a 7-branch oneOf on mode', () => {
    expect((McpClientInputSchema as { oneOf?: unknown[] }).oneOf).toHaveLength(7)
  })

  test('output schema is a 7-branch oneOf on mode', () => {
    expect((McpClientOutputSchema as { oneOf?: unknown[] }).oneOf).toHaveLength(7)
  })

  test('rejects an unknown mode', () => {
    expect(validateInput({ mode: 'nope', url: 'http://x' })).toBe(false)
  })

  test('rejects a mode missing its required url', () => {
    expect(validateInput({ mode: 'list-tools' })).toBe(false)
  })

  test('call-tool rejects when tool is missing', () => {
    expect(validateInput({ mode: 'call-tool', url: 'http://x', args: {} })).toBe(false)
  })

  test('call-tool rejects when args is missing', () => {
    expect(validateInput({ mode: 'call-tool', url: 'http://x', tool: 't' })).toBe(false)
  })

  test('read-resource rejects when uri is missing', () => {
    expect(validateInput({ mode: 'read-resource', url: 'http://x' })).toBe(false)
  })

  test('accepts each of the seven modes with its required fields', () => {
    expect(validateInput({ mode: 'list-tools', url: 'http://x' })).toBe(true)
    expect(validateInput({ mode: 'list-prompts', url: 'http://x' })).toBe(true)
    expect(validateInput({ mode: 'list-resources', url: 'http://x' })).toBe(true)
    expect(validateInput({ mode: 'discover', url: 'http://x' })).toBe(true)
    expect(validateInput({ mode: 'call-tool', url: 'http://x', tool: 't', args: {} })).toBe(true)
    expect(validateInput({ mode: 'get-prompt', url: 'http://x', name: 'p' })).toBe(true)
    expect(validateInput({ mode: 'read-resource', url: 'http://x', uri: 'u' })).toBe(true)
  })

  test('accepts optional shared fields on any mode', () => {
    expect(
      validateInput({
        mode: 'list-tools',
        url: 'http://x',
        headers: { 'x-trace': '1' },
        timeoutMs: 5000,
        auth: { type: 'none' },
      }),
    ).toBe(true)
  })
})

describe('mcp-client tool — seven modes through the shared pool', () => {
  test('round-trips all seven modes against a real in-process MCP server', async () => {
    const pool = createConnectionPool()
    const mcpClient = createMcpClientTool({ getClient: pool.getClient })
    const { url, close } = await startMcpServer()
    try {
      // list-tools
      const tools = (await mcpClient({ mode: 'list-tools', url })) as { mode: string; result: { name: string }[] }
      expect(tools.mode).toBe('list-tools')
      expect(validateOutput(tools)).toBe(true)
      expect(tools.result.map((t) => t.name)).toContain('echo')

      // call-tool
      const called = (await mcpClient({
        mode: 'call-tool',
        url,
        tool: 'echo',
        args: { message: 'hi' },
      })) as { mode: string; result: { content: { type: string; text?: string }[] } }
      expect(called.mode).toBe('call-tool')
      expect(validateOutput(called)).toBe(true)
      expect(called.result.content[0]?.text).toBe('echo:hi')

      // list-prompts
      const prompts = (await mcpClient({ mode: 'list-prompts', url })) as { mode: string; result: { name: string }[] }
      expect(prompts.mode).toBe('list-prompts')
      expect(validateOutput(prompts)).toBe(true)
      expect(prompts.result.map((p) => p.name)).toContain('greet')

      // get-prompt
      const prompt = (await mcpClient({
        mode: 'get-prompt',
        url,
        name: 'greet',
        args: { name: 'sam' },
      })) as { mode: string; result: { role: string; content: { text?: string } }[] }
      expect(prompt.mode).toBe('get-prompt')
      expect(validateOutput(prompt)).toBe(true)
      expect(prompt.result[0]?.content.text).toBe('hello sam')

      // list-resources
      const resources = (await mcpClient({ mode: 'list-resources', url })) as {
        mode: string
        result: { uri: string }[]
      }
      expect(resources.mode).toBe('list-resources')
      expect(validateOutput(resources)).toBe(true)
      expect(resources.result.map((r) => r.uri)).toContain('test://note')

      // read-resource
      const read = (await mcpClient({ mode: 'read-resource', url, uri: 'test://note' })) as {
        mode: string
        result: { text?: string }[]
      }
      expect(read.mode).toBe('read-resource')
      expect(validateOutput(read)).toBe(true)
      expect(read.result[0]?.text).toBe('a note')

      // discover
      const discovered = (await mcpClient({ mode: 'discover', url })) as {
        mode: string
        result: { tools: unknown[]; prompts: unknown[]; resources: unknown[] }
      }
      expect(discovered.mode).toBe('discover')
      expect(validateOutput(discovered)).toBe(true)
      expect(discovered.result.tools).toHaveLength(1)
      expect(discovered.result.prompts).toHaveLength(1)
      expect(discovered.result.resources).toHaveLength(1)
    } finally {
      await pool.closeAll()
      await close()
    }
  })

  test('reuses a single pooled connection across multiple calls', async () => {
    const pool = createConnectionPool()
    const mcpClient = createMcpClientTool({ getClient: pool.getClient })
    const { url, close } = await startMcpServer()
    try {
      expect(pool.size()).toBe(0)
      await mcpClient({ mode: 'list-tools', url })
      expect(pool.size()).toBe(1)
      await mcpClient({ mode: 'list-prompts', url })
      await mcpClient({ mode: 'discover', url })
      // Same url → still exactly one pooled client.
      expect(pool.size()).toBe(1)
    } finally {
      await pool.closeAll()
      await close()
    }
    expect(pool.size()).toBe(0)
  })

  test('separate urls get separate pooled connections', async () => {
    const pool = createConnectionPool()
    const mcpClient = createMcpClientTool({ getClient: pool.getClient })
    const a = await startMcpServer()
    const b = await startMcpServer()
    try {
      await mcpClient({ mode: 'list-tools', url: a.url })
      await mcpClient({ mode: 'list-tools', url: b.url })
      expect(pool.size()).toBe(2)
    } finally {
      await pool.closeAll()
      await a.close()
      await b.close()
    }
  })
})
