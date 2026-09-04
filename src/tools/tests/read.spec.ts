import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import { READ_TOOL_NAME, read } from '../read.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// read tool — exercised through an in-process MCP client/server
// ================================================================

let server: McpServer
let client: Client
let cleanupClosable: (() => Promise<void>) | undefined

const setupServer = async () => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  read(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)

  cleanupClosable = async () => {
    await client.close()
  }
}

const callRead = async (args: Record<string, unknown>) => {
  const result = await client.callTool({ name: READ_TOOL_NAME, arguments: { cwd: process.cwd(), ...args } })
  return result
}

type ReadToolOutput = {
  content: string
  truncated: boolean
  isError?: boolean
  message?: string
}

describe('read tool', () => {
  beforeEach(async () => {
    await setupServer()
  })

  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('listTools includes read', async () => {
    const { tools } = await client.listTools()
    const tool = tools.find((t) => t.name === READ_TOOL_NAME)
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('Read the contents of a file')
  })

  test('reads a text file', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'hello\nworld\nthird line' })
    try {
      const result = await callRead({ path: path.join(dir, 'test.txt') })
      const data = result.structuredContent as ReadToolOutput
      expect(data.truncated).toBe(false)
      expect(data.content).toBe('hello\nworld\nthird line')
    } finally {
      await cleanup()
    }
  })

  test('offset reads from a specific line (1-indexed)', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'line1\nline2\nline3\nline4' })
    try {
      const result = await callRead({ path: path.join(dir, 'test.txt'), offset: 2 })
      const data = result.structuredContent as ReadToolOutput
      expect(data.content).toBe('line2\nline3\nline4')
      expect(data.truncated).toBe(false)
    } finally {
      await cleanup()
    }
  })

  test('offset + limit windows correctly', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'line1\nline2\nline3\nline4\nline5' })
    try {
      const result = await callRead({ path: path.join(dir, 'test.txt'), offset: 2, limit: 2 })
      const data = result.structuredContent as ReadToolOutput
      expect(data.content).toBe('line2\nline3')
      expect(data.truncated).toBe(false)
    } finally {
      await cleanup()
    }
  })

  test('missing file returns error result with isError', async () => {
    const result = await callRead({ path: '/tmp/nonexistent-file-xyz-123' })
    const data = result.structuredContent as ReadToolOutput
    expect(data.isError).toBe(true)
    expect(data.content).toContain('Error')
    expect(data.truncated).toBe(false)
  })

  test('offset beyond file length returns error with isError', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'hello' })
    try {
      const result = await callRead({ path: path.join(dir, 'test.txt'), offset: 10 })
      const data = result.structuredContent as ReadToolOutput
      expect(data.isError).toBe(true)
      expect(data.content).toContain('Error')
    } finally {
      await cleanup()
    }
  })
})

describe('read tool — provisioned cwd', () => {
  beforeEach(async () => {
    await setupServer()
  })

  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('relative path resolves against the composed cwd', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'scoped content' })
    try {
      const result = await callRead({ path: 'test.txt', cwd: dir })
      const data = result.structuredContent as ReadToolOutput
      expect(data.content).toBe('scoped content')
    } finally {
      await cleanup()
    }
  })
})
