import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import {
  lspDiscover,
  lspExecute,
  TYPESCRIPT_LSP_DISCOVER_TOOL_NAME,
  TYPESCRIPT_LSP_EXECUTE_TOOL_NAME,
} from '../typescript-lsp.ts'

let server: McpServer
let client: Client
let cleanupClosable: (() => Promise<void>) | undefined
let tempDir: string

const setupServer = async () => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  lspExecute(server)
  lspDiscover(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)

  cleanupClosable = async () => {
    await client.close()
  }
}

type LspOutput = {
  mode: string
  file?: string
  results?: Array<{ method: string; result?: unknown; error?: string }>
  capabilities?: Array<{ method: string; capability: string }>
  isError?: boolean
}

describe('typescript-lsp tools', () => {
  beforeEach(async () => {
    await setupServer()
    tempDir = await mkdtemp(join(tmpdir(), 'plaited-lsp-'))
  })
  afterEach(async () => {
    await cleanupClosable?.()
    await rm(tempDir, { recursive: true, force: true })
  })

  test('listTools includes lsp tools', async () => {
    const { tools } = await client.listTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain(TYPESCRIPT_LSP_EXECUTE_TOOL_NAME)
    expect(names).toContain(TYPESCRIPT_LSP_DISCOVER_TOOL_NAME)
  })

  test('discovers server capabilities', async () => {
    const result = await client.callTool({
      name: TYPESCRIPT_LSP_DISCOVER_TOOL_NAME,
      arguments: {},
    })
    const data = result.structuredContent as LspOutput
    expect(data.mode).toBe('discover')
    expect(data.capabilities!.length).toBeGreaterThan(0)
    expect(data.capabilities![0]!.method).toBeString()
    expect(data.capabilities![0]!.capability).toBeString()
  })

  test('returns document symbols for a simple file', async () => {
    const filePath = join(tempDir, 'sample.ts')
    const uri = `file://${filePath}`
    await writeFile(filePath, 'export const x = 1\n')

    const result = await client.callTool({
      name: TYPESCRIPT_LSP_EXECUTE_TOOL_NAME,
      arguments: {
        file: filePath,
        rootDir: tempDir,
        requests: [{ method: 'textDocument/documentSymbol', params: { textDocument: { uri } } }],
      },
    })
    const data = result.structuredContent as LspOutput
    expect(data.mode).toBe('execute')
    expect(data.results).toHaveLength(1)
    expect(data.results![0]!.method).toBe('textDocument/documentSymbol')
    expect(data.results![0]!.result).toBeDefined()
  })

  test('returns error for unsupported method', async () => {
    const filePath = join(tempDir, 'sample.ts')
    const uri = `file://${filePath}`
    await writeFile(filePath, 'export const x = 1\n')

    const result = await client.callTool({
      name: TYPESCRIPT_LSP_EXECUTE_TOOL_NAME,
      arguments: {
        file: filePath,
        rootDir: tempDir,
        requests: [{ method: 'textDocument/unknownMethod', params: { textDocument: { uri } } }],
      },
    })
    const data = result.structuredContent as LspOutput
    expect(data.mode).toBe('execute')
    expect(data.results![0]!.error).toContain('Unsupported method')
  })

  test('returns error for missing uri', async () => {
    const filePath = join(tempDir, 'sample.ts')
    await writeFile(filePath, 'export const x = 1\n')

    const result = await client.callTool({
      name: TYPESCRIPT_LSP_EXECUTE_TOOL_NAME,
      arguments: {
        file: filePath,
        rootDir: tempDir,
        requests: [{ method: 'textDocument/documentSymbol', params: {} }],
      },
    })
    const data = result.structuredContent as LspOutput
    expect(data.results![0]!.error).toBeTruthy()
  })

  test('returns hover info for a symbol', async () => {
    const filePath = join(tempDir, 'sample.ts')
    const uri = `file://${filePath}`
    await writeFile(filePath, 'export const x = 1\n')

    const result = await client.callTool({
      name: TYPESCRIPT_LSP_EXECUTE_TOOL_NAME,
      arguments: {
        file: filePath,
        rootDir: tempDir,
        requests: [
          { method: 'textDocument/hover', params: { textDocument: { uri }, position: { line: 0, character: 13 } } },
        ],
      },
    })
    const data = result.structuredContent as LspOutput
    expect(data.results![0]!.method).toBe('textDocument/hover')
    // Should not error — hover at 'x' should return type info
    expect(data.results![0]!.error).toBeUndefined()
  })
})
