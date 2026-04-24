import { describe, expect, test } from 'bun:test'
import { AddRemoteMcpInputSchema, AddRemoteMcpOutputSchema } from '../scripts/cli.ts'

describe('AddRemoteMcpInputSchema', () => {
  test('accepts discovery requests', () => {
    const parsed = AddRemoteMcpInputSchema.parse({
      url: 'https://bun.com/docs/mcp',
      operation: {
        type: 'discover',
      },
    })

    expect(parsed.operation.type).toBe('discover')
  })

  test('accepts prompt retrieval requests', () => {
    const parsed = AddRemoteMcpInputSchema.parse({
      url: 'https://bun.com/docs/mcp',
      timeoutMs: 30_000,
      operation: {
        type: 'get-prompt',
        name: 'example',
        arguments: {
          topic: 'auth',
        },
      },
    })

    expect(parsed.operation.type).toBe('get-prompt')
    if (parsed.operation.type !== 'get-prompt') {
      throw new Error('Expected get-prompt operation')
    }
    expect(parsed.operation.arguments).toEqual({ topic: 'auth' })
  })

  test('rejects invalid URLs', () => {
    expect(() =>
      AddRemoteMcpInputSchema.parse({
        url: 'not-a-url',
        operation: {
          type: 'discover',
        },
      }),
    ).toThrow()
  })
})

describe('AddRemoteMcpOutputSchema', () => {
  test('accepts generic result payloads', () => {
    const parsed = AddRemoteMcpOutputSchema.parse({
      url: 'https://bun.com/docs/mcp',
      operation: 'list-tools',
      result: [{ name: 'search_docs' }],
    })

    expect(parsed.operation).toBe('list-tools')
  })
})

describe('add-remote-mcp docs', () => {
  test('scope protected servers to the protected skill', async () => {
    const skill = await Bun.file(`${import.meta.dir}/../SKILL.md`).text()

    expect(skill).toContain('add-protected-remote-mcp')
    expect(skill).toContain('No secrets in repo')
    expect(skill).toContain('public or simply-authenticated remote MCP servers')
  })
})
