import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { createOpenAICompatModel } from '../openai-compat.ts'

let srv: ReturnType<typeof Bun.serve> | undefined

const startServer = async (fetch: (request: Request) => Response | Promise<Response>) => {
  let lastError: unknown
  for (let attempt = 1; attempt <= 50; attempt += 1) {
    try {
      srv = Bun.serve({
        port: 0,
        fetch,
      })
      break
    } catch (error) {
      lastError = error
      const message =
        error instanceof Error ? `${error.message} ${String((error as { code?: unknown }).code ?? '')}` : ''
      if (!message.includes('EADDRINUSE') && !message.includes('port 0 in use')) {
        throw error
      }
      await Bun.sleep(100)
    }
  }

  if (!srv) {
    throw lastError
  }
  return `http://localhost:${srv.port}/v1`
}

beforeEach(() => {
  srv = undefined
})

afterEach(async () => {
  if (!srv) {
    return
  }
  await Promise.resolve(srv.stop(true))
  srv = undefined
  await Bun.sleep(5)
})

describe('createOpenAICompatModel', () => {
  test('streams text deltas and usage from SSE responses', async () => {
    const baseUrl = await startServer(
      () =>
        new Response(
          [
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
            'data: {"usage":{"prompt_tokens":11,"completion_tokens":7}}\n\n',
            'data: [DONE]\n\n',
          ].join(''),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    )

    const model = createOpenAICompatModel({ baseUrl, model: 'test' })
    const result = await model({
      messages: [{ role: 'user', content: 'hi' }],
      timeout: 1_000,
    })

    expect(result).toEqual({
      parsed: { thinking: null, toolCalls: [], message: 'Hello world' },
      usage: { inputTokens: 11, outputTokens: 7 },
    })
  }, 30000)

  test('streams reasoning deltas and tool call deltas', async () => {
    const baseUrl = await startServer(
      () =>
        new Response(
          [
            'data: {"choices":[{"delta":{"reasoning_content":"think"}}]}\n\n',
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc-1","function":{"name":"read_file","arguments":"{\\"path\\":\\"a"}}]}}]}\n\n',
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"bc\\"}"}}]}}]}\n\n',
            'data: {"usage":{"prompt_tokens":3,"completion_tokens":5}}\n\n',
            'data: [DONE]\n\n',
          ].join(''),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    )

    const model = createOpenAICompatModel({ baseUrl, model: 'test' })
    const result = await model({
      messages: [{ role: 'user', content: 'hi' }],
      timeout: 1_000,
    })

    expect(result).toEqual({
      parsed: {
        thinking: 'think',
        toolCalls: [{ id: 'tc-1', name: 'read_file', arguments: { path: 'abc' } }],
        message: null,
      },
      usage: { inputTokens: 3, outputTokens: 5 },
    })
  }, 30000)

  test('throws for non-ok responses', async () => {
    const baseUrl = await startServer(() => new Response('bad request', { status: 400 }))

    const model = createOpenAICompatModel({ baseUrl, model: 'test' })
    await expect(
      model({
        messages: [{ role: 'user', content: 'hi' }],
        timeout: 1_000,
      }),
    ).rejects.toThrow('400: bad request')
  }, 30000)

  test('throws when no response body is available', async () => {
    const originalFetch = globalThis.fetch
    globalThis.fetch = Object.assign(
      async (..._args: Parameters<typeof fetch>) =>
        new Response(null, {
          status: 200,
        }),
      {
        preconnect: originalFetch.preconnect.bind(originalFetch),
      },
    ) as typeof fetch

    try {
      const model = createOpenAICompatModel({ baseUrl: 'http://localhost:0/v1', model: 'test' })
      await expect(
        model({
          messages: [{ role: 'user', content: 'hi' }],
          timeout: 1_000,
        }),
      ).rejects.toThrow('No response body')
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
