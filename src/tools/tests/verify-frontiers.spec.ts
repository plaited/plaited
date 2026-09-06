import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import { VERIFY_FRONTIERS_TOOL_NAME, verifyFrontiersTool } from '../verify-frontiers.ts'

let server: McpServer
let client: Client
let cleanupClosable: (() => Promise<void>) | undefined

const setupServer = async () => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  verifyFrontiersTool(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)

  cleanupClosable = async () => {
    await client.close()
  }
}

const callVerify = async (args: Record<string, unknown>) => {
  const result = await client.callTool({ name: VERIFY_FRONTIERS_TOOL_NAME, arguments: args })
  return result.structuredContent as Record<string, unknown>
}

type VerifyOutput = {
  ok?: boolean
  status?: 'verified' | 'failed' | 'truncated'
  findings?: unknown[]
  livelocks?: unknown[]
  report?: {
    strategy: 'bfs' | 'dfs'
    selectionPolicy: 'all-enabled' | 'scheduler'
    visitedCount: number
    findingCount: number
    truncated: boolean
    maxDepth?: number
  }
  message?: string
  isError?: boolean
  errors?: unknown
}

describe('verify_frontiers tool', () => {
  beforeEach(async () => {
    await setupServer()
  })

  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('listTools includes verify_frontiers', async () => {
    const { tools } = await client.listTools()
    const tool = tools.find((t) => t.name === VERIFY_FRONTIERS_TOOL_NAME)
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('Verify')
  })

  test('a clean thread returns status verified', async () => {
    const data = (await callVerify({
      threads: [{ label: 'ok', rules: [{ request: { type: 'a' } }] }],
    })) as VerifyOutput

    expect(data.isError).toBeUndefined()
    expect(data.ok).toBe(true)
    expect(data.status).toBe('verified')
    expect(data.findings).toEqual([])
    expect(data.livelocks).toEqual([])
    expect(data.report?.truncated).toBe(false)
  })

  test('a self-deadlocking thread returns status failed with non-empty findings', async () => {
    const data = (await callVerify({
      threads: [{ label: 'bad', rules: [{ request: { type: 'a' }, block: [{ type: 'a' }] }] }],
    })) as VerifyOutput

    expect(data.isError).toBeUndefined()
    expect(data.ok).toBe(true)
    expect(data.status).toBe('failed')
    expect(data.findings!.length).toBeGreaterThan(0)
    expect(data.report?.findingCount).toBeGreaterThan(0)
  })

  test('a thread explored with maxDepth 1 where the frontier is not exhausted returns truncated', async () => {
    // A looping thread (no `once`) requesting 'a' then 'b' in sequence. Each
    // selection advances to a distinct pending state, so maxDepth: 1 cuts off
    // exploration while successors remain — report.truncated becomes true.
    const data = (await callVerify({
      threads: [
        {
          label: 'loop',
          rules: [{ request: { type: 'a' } }, { request: { type: 'b' } }],
        },
      ],
      maxDepth: 1,
    })) as VerifyOutput

    expect(data.isError).toBeUndefined()
    expect(data.ok).toBe(true)
    expect(data.status).toBe('truncated')
    expect(data.report?.truncated).toBe(true)
    expect(data.report?.maxDepth).toBe(1)
  })

  test('a thread missing rules returns isError (validateThread guard fires, not an exception)', async () => {
    const data = (await callVerify({
      threads: [{ label: 'no-rules' }],
    })) as VerifyOutput

    expect(data.isError).toBe(true)
    expect(data.ok).toBe(false)
    expect(data.message).toBe('invalid thread')
    expect(data.errors).toBeDefined()
  })
})
