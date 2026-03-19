import { describe, expect, test } from 'bun:test'
import { createRemoteMcpSession, mcpCallTool, mcpListTools, remoteMcpConnect } from '../mcp.utils.ts'

const BUN_DOCS_URL = 'https://bun.com/docs/mcp'
const MCP_DOCS_URL = 'https://modelcontextprotocol.io/mcp'
const AGENT_SKILLS_URL = 'https://agentskills.io/mcp'

describe('remoteMcpConnect', () => {
  test('connects to bun-docs server', async () => {
    const client = await remoteMcpConnect(BUN_DOCS_URL)
    expect(client).toBeDefined()
    await client.close()
  })

  test('throws on invalid URL', async () => {
    await expect(remoteMcpConnect('https://localhost:1/nonexistent')).rejects.toThrow()
  })
})

describe('mcpListTools', () => {
  test('lists tools from bun-docs server', async () => {
    const tools = await mcpListTools(BUN_DOCS_URL)
    expect(tools.length).toBeGreaterThan(0)
    const searchTool = tools.find((tool) => tool.name === 'search_bun')
    expect(searchTool).toBeDefined()
    expect(searchTool?.inputSchema).toBeDefined()
  })

  test('lists tools from mcp-docs server', async () => {
    const tools = await mcpListTools(MCP_DOCS_URL)
    expect(tools.length).toBeGreaterThan(0)
    const searchTool = tools.find((tool) => tool.name === 'search_model_context_protocol')
    expect(searchTool).toBeDefined()
  })

  test('lists tools from agent-skills server', async () => {
    const tools = await mcpListTools(AGENT_SKILLS_URL)
    expect(tools.length).toBeGreaterThan(0)
    const searchTool = tools.find((tool) => tool.name === 'search_agent_skills')
    expect(searchTool).toBeDefined()
  })
})

describe('mcpCallTool', () => {
  test('searches bun-docs for Bun.file', async () => {
    const result = await mcpCallTool(BUN_DOCS_URL, 'search_bun', { query: 'Bun.file' })
    expect(result.content.length).toBeGreaterThan(0)
    const first = result.content[0]
    expect(first?.type).toBe('text')
    expect(first?.text).toBeString()
  })

  test('searches mcp-docs for tools/call', async () => {
    const result = await mcpCallTool(MCP_DOCS_URL, 'search_model_context_protocol', {
      query: 'tools/call request',
    })
    expect(result.content.length).toBeGreaterThan(0)
    const first = result.content[0]
    expect(first?.type).toBe('text')
  })

  test('searches agent-skills for SKILL.md', async () => {
    const result = await mcpCallTool(AGENT_SKILLS_URL, 'search_agent_skills', {
      query: 'SKILL.md frontmatter',
    })
    expect(result.content.length).toBeGreaterThan(0)
    const first = result.content[0]
    expect(first?.type).toBe('text')
  })
})

describe('createRemoteMcpSession', () => {
  test('reuses connection across multiple operations', async () => {
    await using session = await createRemoteMcpSession(BUN_DOCS_URL)

    const tools = await session.listTools()
    expect(tools.length).toBeGreaterThan(0)

    const result = await session.callTool('search_bun', { query: 'Bun.serve' })
    expect(result.content.length).toBeGreaterThan(0)
  })

  test('supports timeoutMs option', async () => {
    await using session = await createRemoteMcpSession(BUN_DOCS_URL, { timeoutMs: 30_000 })
    const tools = await session.listTools()
    expect(tools.length).toBeGreaterThan(0)
  })

  test('discover returns tools, prompts, and resources', async () => {
    await using session = await createRemoteMcpSession(BUN_DOCS_URL)
    const capabilities = await session.discover()
    expect(capabilities.tools.length).toBeGreaterThan(0)
    expect(Array.isArray(capabilities.prompts)).toBe(true)
    expect(Array.isArray(capabilities.resources)).toBe(true)
  })
})
