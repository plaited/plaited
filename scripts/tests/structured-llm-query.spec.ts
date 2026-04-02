import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { z } from 'zod'
import { isAllowedReadPath, runStructuredLlmQuery } from '../structured-llm-query.ts'

describe('structured-llm-query', () => {
  test('allows reads under configured roots', () => {
    expect(
      isAllowedReadPath({
        workspaceRoot: '/tmp/worktree',
        allowedRoots: ['skills/mss', 'dev-research/mss-seed'],
        path: 'skills/mss/SKILL.md',
      }),
    ).toBe(true)
  })

  test('blocks reads outside configured roots', () => {
    expect(
      isAllowedReadPath({
        workspaceRoot: '/tmp/worktree',
        allowedRoots: ['skills/mss', 'dev-research/mss-seed'],
        path: 'scripts/autoresearch-runner.ts',
      }),
    ).toBe(false)
  })

  test('supports bounded read_file tool calling', async () => {
    const root = await mkdtemp(join(tmpdir(), 'plaited-structured-query-'))
    const skillDir = join(root, 'skills', 'mss')
    await Bun.$`mkdir -p ${skillDir}`.quiet()
    await Bun.write(join(skillDir, 'SKILL.md'), '# MSS\n')

    const originalFetch = globalThis.fetch
    const originalKey = process.env.OPENROUTER_API_KEY
    process.env.OPENROUTER_API_KEY = 'test-key'
    const calls: string[] = []

    globalThis.fetch = (async (_input: RequestInfo | URL, init?: RequestInit) => {
      const bodyText = typeof init?.body === 'string' ? init.body : ''
      calls.push(bodyText)
      if (calls.length === 1) {
        return new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: null,
                  tool_calls: [
                    {
                      id: 'call_1',
                      type: 'function',
                      function: {
                        name: 'read_file',
                        arguments: JSON.stringify({ path: 'skills/mss/SKILL.md' }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        )
      }

      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({ verdict: 'ok' }),
              },
            },
          ],
        }),
        { status: 200 },
      )
    }) as typeof fetch

    try {
      const result = await runStructuredLlmQuery<{ verdict: string }>({
        model: 'test-model',
        prompt: 'Evaluate the attempt.',
        schema: z.toJSONSchema(z.object({ verdict: z.string() })),
        workspaceReadAccess: {
          workspaceRoot: root,
          allowedRoots: ['skills/mss'],
        },
      })

      expect(result.ok).toBe(true)
      if (result.ok) {
        expect(result.value.verdict).toBe('ok')
        expect(result.meta?.toolRounds).toBe(1)
      }
      expect(calls).toHaveLength(2)
      expect(calls[1]).toContain('"role":"tool"')
      expect(calls[1]).toContain('"tools"')
    } finally {
      globalThis.fetch = originalFetch
      if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
      else process.env.OPENROUTER_API_KEY = originalKey
      await rm(root, { force: true, recursive: true })
    }
  })

  test('rejects out-of-scope read_file tool calls', async () => {
    const root = await mkdtemp(join(tmpdir(), 'plaited-structured-query-block-'))
    const originalFetch = globalThis.fetch
    const originalKey = process.env.OPENROUTER_API_KEY
    process.env.OPENROUTER_API_KEY = 'test-key'

    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: null,
                tool_calls: [
                  {
                    id: 'call_1',
                    type: 'function',
                    function: {
                      name: 'read_file',
                      arguments: JSON.stringify({ path: 'scripts/autoresearch-runner.ts' }),
                    },
                  },
                ],
              },
            },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch

    try {
      const result = await runStructuredLlmQuery<{ verdict: string }>({
        model: 'test-model',
        prompt: 'Evaluate the attempt.',
        schema: z.toJSONSchema(z.object({ verdict: z.string() })),
        workspaceReadAccess: {
          workspaceRoot: root,
          allowedRoots: ['skills/mss'],
        },
      })

      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.reason).toContain('outside allowed roots')
      }
    } finally {
      globalThis.fetch = originalFetch
      if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
      else process.env.OPENROUTER_API_KEY = originalKey
      await rm(root, { force: true, recursive: true })
    }
  })
})
