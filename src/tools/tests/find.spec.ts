import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import { FIND_TOOL_NAME, find } from '../find.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// find tool — exercised through an in-process MCP client/server
// ================================================================

let server: McpServer
let client: Client
let cleanupClosable: (() => Promise<void>) | undefined

const setupServer = async () => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  find(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)

  cleanupClosable = async () => {
    await client.close()
  }
}

const callFind = async (args: Record<string, unknown>) => {
  const result = await client.callTool({ name: FIND_TOOL_NAME, arguments: { cwd: process.cwd(), ...args } })
  return result
}

type FindToolOutput = {
  paths: string[]
  message?: string
  isError?: boolean
}

describe('find tool', () => {
  beforeEach(async () => {
    await setupServer()
  })

  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('listTools includes find', async () => {
    const { tools } = await client.listTools()
    const tool = tools.find((t) => t.name === FIND_TOOL_NAME)
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('Find files matching a glob pattern')
  })

  test('finds files matching glob pattern', async () => {
    const { dir, cleanup } = await tempDir({
      'a.ts': '',
      'b.ts': '',
      'c.js': '',
      'sub/d.ts': '',
    })

    try {
      const result = await callFind({ pattern: '*.ts', dir })
      const data = result.structuredContent as FindToolOutput
      expect(data.paths).toHaveLength(2)
      expect(data.paths).toContain('a.ts')
      expect(data.paths).toContain('b.ts')
    } finally {
      await cleanup()
    }
  })

  test('recursive glob with **', async () => {
    const { dir, cleanup } = await tempDir({
      'a.ts': '',
      'sub/b.ts': '',
      'sub/c.js': '',
    })

    try {
      const result = await callFind({ pattern: '**/*.ts', dir })
      const data = result.structuredContent as FindToolOutput
      expect(data.paths).toHaveLength(2)
      expect(data.paths).toContain('a.ts')
      expect(data.paths).toContain('sub/b.ts')
    } finally {
      await cleanup()
    }
  })

  test('no matching pattern returns empty paths with info message', async () => {
    const { dir, cleanup } = await tempDir({ 'a.ts': '' })
    try {
      const result = await callFind({ pattern: '*.js', dir })
      const data = result.structuredContent as FindToolOutput
      expect(data.paths).toHaveLength(0)
      expect(data.message).toContain('no files matched')
      expect(data.isError).toBeUndefined()
    } finally {
      await cleanup()
    }
  })
})
