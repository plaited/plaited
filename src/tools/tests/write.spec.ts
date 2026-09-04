import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import { WRITE_TOOL_NAME, write } from '../write.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// write tool — exercised through an in-process MCP client/server
// ================================================================

let server: McpServer
let client: Client
let cleanupClosable: (() => Promise<void>) | undefined

const setupServer = async () => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  write(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)

  cleanupClosable = async () => {
    await client.close()
  }
}

const callWrite = async (args: Record<string, unknown>) => {
  const result = await client.callTool({ name: WRITE_TOOL_NAME, arguments: { cwd: process.cwd(), ...args } })
  return result
}

type WriteToolOutput = {
  bytesWritten: number
}

describe('write tool', () => {
  beforeEach(async () => {
    await setupServer()
  })

  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('listTools includes write', async () => {
    const { tools } = await client.listTools()
    const tool = tools.find((t) => t.name === WRITE_TOOL_NAME)
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('Write content to a file')
  })

  test('writes content to a file', async () => {
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'output.txt')
    try {
      const result = await callWrite({ path: filePath, content: 'hello world' })
      const data = result.structuredContent as WriteToolOutput
      expect(data.bytesWritten).toBe(11)
      expect(await Bun.file(filePath).text()).toBe('hello world')
    } finally {
      await cleanup()
    }
  })

  test('creates parent directories', async () => {
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'a', 'b', 'nested.txt')
    try {
      await callWrite({ path: filePath, content: 'nested' })
      expect(await Bun.file(filePath).text()).toBe('nested')
    } finally {
      await cleanup()
    }
  })

  test('overwrites existing file', async () => {
    const { dir, cleanup } = await tempDir({ 'existing.txt': 'old content' })
    const filePath = path.join(dir, 'existing.txt')
    try {
      await callWrite({ path: filePath, content: 'new content' })
      expect(await Bun.file(filePath).text()).toBe('new content')
    } finally {
      await cleanup()
    }
  })

  test('relative path resolves against the composed cwd', async () => {
    const { dir, cleanup } = await tempDir({})
    try {
      await callWrite({ path: 'rel/nested.txt', content: 'scoped', cwd: dir })
      expect(await Bun.file(path.join(dir, 'rel/nested.txt')).text()).toBe('scoped')
    } finally {
      await cleanup()
    }
  })
})
