import { test, expect, beforeAll, afterAll } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

let client: Client

beforeAll(async () => {
  const transport = new StdioClientTransport({
    command: 'bun',
    args: [Bun.resolveSync('./fixtures/test-mcp-server.ts', import.meta.dir)],
  })

  client = new Client({
    name: 'test-client',
    version: '0.0.0',
  })

  await client.connect(transport)
})

afterAll(async () => {
  await client.close()
})

test.only('test-echo tool works', async () => {
  const tools = await client.listTools()
  const testTool = tools.tools.find((t) => t.name === 'test-echo')
  expect(testTool).toBeDefined()

  const result = await client.callTool({ name: 'test-echo', arguments: { message: 'Hello World' } })

  const content = result.content as { type: string; text: string }[]
  expect(content).toBeDefined()

  const text = content[0]?.text
  expect(text).toBe('Echo: Hello World')
})
