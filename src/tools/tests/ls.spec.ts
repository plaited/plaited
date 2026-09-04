import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import { LS_TOOL_NAME, ls } from '../ls.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// ls tool — exercised through an in-process MCP client/server
// ================================================================

let server: McpServer
let client: Client
let cleanupClosable: (() => Promise<void>) | undefined

const setupServer = async () => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  ls(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)

  cleanupClosable = async () => {
    await client.close()
  }
}

const callLs = async (args: Record<string, unknown>) => {
  const result = await client.callTool({ name: LS_TOOL_NAME, arguments: { cwd: process.cwd(), ...args } })
  return result
}

type LsToolOutput = {
  entries: Array<{ name: string; type: 'file' | 'directory' | 'symlink' | 'unknown' }>
  message?: string
  isError?: boolean
}

describe('ls tool', () => {
  beforeEach(async () => {
    await setupServer()
  })

  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('listTools includes ls', async () => {
    const { tools } = await client.listTools()
    const tool = tools.find((t) => t.name === LS_TOOL_NAME)
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('List entries in a directory')
  })

  test('lists directory entries with types', async () => {
    const { dir, cleanup } = await tempDir({})
    await Bun.write(path.join(dir, 'file.txt'), 'content')
    await Bun.$`mkdir -p ${path.join(dir, 'subdir')}`.quiet().nothrow()

    try {
      const result = await callLs({ dir })
      const data = result.structuredContent as LsToolOutput
      const names = data.entries.map((e) => e.name)
      expect(names).toContain('file.txt')
      expect(names).toContain('subdir')

      const fileEntry = data.entries.find((e) => e.name === 'file.txt')
      expect(fileEntry!.type).toBe('file')

      const dirEntry = data.entries.find((e) => e.name === 'subdir')
      expect(dirEntry!.type).toBe('directory')
    } finally {
      await cleanup()
    }
  })
})
