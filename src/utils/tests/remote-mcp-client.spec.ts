import { describe, expect, test } from 'bun:test'
import { mcpCallTool, mcpConnect, mcpListTools } from '../remote-mcp-client.ts'

const BUN_DOCS_URL = 'https://bun.com/docs/mcp'
const MCP_DOCS_URL = 'https://modelcontextprotocol.io/mcp'
const AGENT_SKILLS_URL = 'https://agentskills.io/mcp'

describe('mcpConnect', () => {
  test('connects to bun-docs server', async () => {
    const client = await mcpConnect(BUN_DOCS_URL)
    expect(client).toBeDefined()
    await client.close()
  })

  test('throws on invalid URL', async () => {
    await expect(mcpConnect('https://localhost:1/nonexistent')).rejects.toThrow()
  })
})

describe('mcpListTools', () => {
  test('lists tools from bun-docs server', async () => {
    const tools = await mcpListTools(BUN_DOCS_URL)
    expect(tools.length).toBeGreaterThan(0)
    const searchTool = tools.find((t) => t.name === 'SearchBun')
    expect(searchTool).toBeDefined()
    expect(searchTool?.inputSchema).toBeDefined()
  })

  test('lists tools from mcp-docs server', async () => {
    const tools = await mcpListTools(MCP_DOCS_URL)
    expect(tools.length).toBeGreaterThan(0)
    const searchTool = tools.find((t) => t.name === 'SearchModelContextProtocol')
    expect(searchTool).toBeDefined()
  })

  test('lists tools from agent-skills server', async () => {
    const tools = await mcpListTools(AGENT_SKILLS_URL)
    expect(tools.length).toBeGreaterThan(0)
    const searchTool = tools.find((t) => t.name === 'SearchAgentSkills')
    expect(searchTool).toBeDefined()
  })
})

describe('mcpCallTool', () => {
  test('searches bun-docs for Bun.file', async () => {
    const result = await mcpCallTool(BUN_DOCS_URL, 'SearchBun', { query: 'Bun.file' })
    expect(result.content.length).toBeGreaterThan(0)
    const first = result.content[0]
    expect(first).toBeDefined()
    if (first) {
      expect(first.type).toBe('text')
      expect('text' in first && first.text).toBeString()
    }
  })

  test('searches mcp-docs for tools/call', async () => {
    const result = await mcpCallTool(MCP_DOCS_URL, 'SearchModelContextProtocol', {
      query: 'tools/call request',
    })
    expect(result.content.length).toBeGreaterThan(0)
    const first = result.content[0]
    expect(first).toBeDefined()
    if (first) {
      expect(first.type).toBe('text')
    }
  })

  test('searches agent-skills for SKILL.md', async () => {
    const result = await mcpCallTool(AGENT_SKILLS_URL, 'SearchAgentSkills', {
      query: 'SKILL.md frontmatter',
    })
    expect(result.content.length).toBeGreaterThan(0)
    const first = result.content[0]
    expect(first).toBeDefined()
    if (first) {
      expect(first.type).toBe('text')
    }
  })
})
