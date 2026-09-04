import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import { GREP_TOOL_NAME, grep } from '../grep.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// grep tool — exercised through an in-process MCP client/server
// ================================================================

let server: McpServer
let client: Client
let cleanupClosable: (() => Promise<void>) | undefined

const setupServer = async () => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  grep(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)

  cleanupClosable = async () => {
    await client.close()
  }
}

const callGrep = async (args: Record<string, unknown>) => {
  const result = await client.callTool({ name: GREP_TOOL_NAME, arguments: { cwd: process.cwd(), ...args } })
  return result
}

type GrepToolOutput = {
  matches: Array<{ path: string; line: number; text: string }>
  truncated: boolean
  message?: string
  isError?: boolean
}

describe('grep tool', () => {
  beforeEach(async () => {
    await setupServer()
  })

  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('listTools includes grep', async () => {
    const { tools } = await client.listTools()
    const tool = tools.find((t) => t.name === GREP_TOOL_NAME)
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('Search for a pattern in files')
  })

  test('finds matching lines in files', async () => {
    const { dir, cleanup } = await tempDir({
      'file1.txt': 'hello world\nfoo bar\nhello again',
    })

    try {
      const result = await callGrep({ pattern: 'hello', dir })
      const data = result.structuredContent as GrepToolOutput
      expect(data.matches.length).toBeGreaterThanOrEqual(1)
      const match = data.matches.find((m) => m.line === 1)
      expect(match).toBeDefined()
      expect(match!.text).toContain('hello')
    } finally {
      await cleanup()
    }
  })

  test('no matches returns empty array with info message', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'hello world' })
    try {
      const result = await callGrep({ pattern: 'zzz_nonexistent', dir })
      const data = result.structuredContent as GrepToolOutput
      expect(data.matches).toHaveLength(0)
      expect(data.message).toContain('no matches')
      expect(data.isError).toBeUndefined()
    } finally {
      await cleanup()
    }
  })
})
