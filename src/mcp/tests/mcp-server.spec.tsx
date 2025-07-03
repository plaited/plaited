import { test, expect, describe, beforeAll, afterAll } from 'bun:test'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

let client: Client

beforeAll(async () => {
  const transport = new StdioClientTransport({
    command: 'bun',
    args: [`${import.meta.dir}/mcp-server.ts`],
  })

  client = new Client({
    name: 'test-client',
    version: '0.0.1',
  })

  await client.connect(transport)
})

afterAll(async () => {
  await client.close()
})

describe('defineMCPServer', () => {
  test('prompt', async () => {
    const output = await client.getPrompt({
      name: 'prompt',
      arguments: {
        code: '() => {}',
      },
    })
    expect(output).toEqual({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: 'Please review this code:\n\n() => {}',
          },
        },
      ],
    })
  })
  test('resource', async () => {
    const output = await client.readResource({
      uri: 'config://app',
    })
    expect(output).toEqual({
      contents: [
        {
          uri: 'config://app',
          text: 'App configuration here',
        },
      ],
    })
  })
  test('resourceTemplate', async () => {
    const output = await client.readResource({
      uri: 'github://repos/org1/project2',
    })
    expect(output).toEqual({
      contents: [
        {
          uri: 'github://repos/org1/project2',
          text: 'Repository: org1/project2',
        },
      ],
    })
  })
  test('tool', async () => {
    const output = await client.callTool({
      name: 'tool',
      arguments: {
        a: 3,
        b: 8,
      },
    })
    expect(output).toEqual({
      content: [
        {
          type: 'text',
          text: '11',
        },
      ],
      structuredContent: {
        value: 11,
      },
    })
  })
})
