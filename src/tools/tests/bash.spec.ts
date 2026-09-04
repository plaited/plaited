import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { realpathSync } from 'node:fs'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import { BASH_NAME, bash } from '../bash.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// bash tool — exercised through an in-process MCP client/server
// ================================================================

let server: McpServer
let client: Client
let cleanupClosable: (() => Promise<void>) | undefined

const setupServer = async () => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  bash(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)

  cleanupClosable = async () => {
    await client.close()
  }
}

const callBash = async (args: Record<string, unknown>) => {
  const result = await client.callTool({ name: BASH_NAME, arguments: { cwd: process.cwd(), ...args } })
  return result
}

describe('bash tool', () => {
  beforeEach(async () => {
    await setupServer()
  })

  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('listTools includes bash', async () => {
    const { tools } = await client.listTools()
    const tool = tools.find((t) => t.name === BASH_NAME)
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('Execute a bash command')
  })

  test('executes a command and returns stdout', async () => {
    const result = await callBash({ command: 'echo "hello"' })
    const data = result.structuredContent as { stdout: string; stderr: string; exitCode: number }
    expect(data.exitCode).toBe(0)
    expect(data.stdout.trim()).toBe('hello')
  })

  test('returns stderr on error', async () => {
    const result = await callBash({ command: 'echo "err" >&2; exit 1' })
    const data = result.structuredContent as { stdout: string; stderr: string; exitCode: number }
    expect(data.exitCode).toBe(1)
    expect(data.stderr.trim()).toBe('err')
  })

  test('timeout returns error stderr', async () => {
    const result = await callBash({ command: 'sleep 10', timeout: 1 })
    const data = result.structuredContent as {
      stdout: string
      stderr: string
      exitCode: number
    }
    expect(data.exitCode).toBe(-1)
    expect(data.stderr).toContain('timed out')
  })

  test('output exceeding line limit is tail-truncated with truncated flag', async () => {
    const result = await callBash({ command: 'seq 1 3000' })
    const data = result.structuredContent as {
      stdout: string
      truncated: boolean
    }
    expect(data.truncated).toBe(true)
    const lines = data.stdout.split('\n')
    expect(lines.length).toBeLessThanOrEqual(2001)
    expect(lines[0]).toBe('1001')
    expect(lines.at(-2)).toBe('3000')
  })

  test('control characters are sanitized from output', async () => {
    const result = await callBash({ command: `printf 'a\\x01b\\x02c'` })
    const data = result.structuredContent as { stdout: string }
    expect(data.stdout).toBe('abc')
  })

  test('cwd scopes the working directory', async () => {
    const { dir, cleanup } = await tempDir({})
    try {
      const result = await callBash({ command: 'pwd', cwd: dir })
      const data = result.structuredContent as { stdout: string; exitCode: number }
      expect(data.exitCode).toBe(0)
      expect(realpathSync(data.stdout.trim())).toBe(realpathSync(dir))
    } finally {
      await cleanup()
    }
  })
})
