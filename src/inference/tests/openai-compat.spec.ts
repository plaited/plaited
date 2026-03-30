import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { createOpenAICompatModel } from '../openai-compat.ts'

let srv: ReturnType<typeof Bun.serve> | undefined

beforeEach(() => {
  srv = undefined
})

afterEach(() => {
  srv?.stop(true)
})

const collect = async <T>(iter: AsyncIterable<T>) => {
  const items: T[] = []
  for await (const item of iter) {
    items.push(item)
  }
  return items
}

describe('createOpenAICompatModel', () => {
  test('streams text deltas and usage from SSE responses', async () => {
    srv = Bun.serve({
      port: 0,
      fetch() {
        return new Response(
          [
            'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
            'data: {"choices":[{"delta":{"content":" world"}}]}\n\n',
            'data: {"usage":{"prompt_tokens":11,"completion_tokens":7}}\n\n',
            'data: [DONE]\n\n',
          ].join(''),
          { headers: { 'Content-Type': 'text/event-stream' } },
        )
      },
    })

    const model = createOpenAICompatModel({ baseUrl: `http://localhost:${srv.port}/v1`, model: 'test' })
    const events = await collect(
      model.reason({
        messages: [{ role: 'user', content: 'hi' }],
        signal: AbortSignal.timeout(1_000),
      }),
    )

    expect(events).toEqual([
      { type: 'text_delta', content: 'Hello' },
      { type: 'text_delta', content: ' world' },
      { type: 'done', response: { usage: { inputTokens: 11, outputTokens: 7 } } },
    ])
  })

  test('streams reasoning deltas and tool call deltas', async () => {
    srv = Bun.serve({
      port: 0,
      fetch() {
        return new Response(
          [
            'data: {"choices":[{"delta":{"reasoning_content":"think"}}]}\n\n',
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"tc-1","function":{"name":"read_file","arguments":"{\\"path\\":\\"a"}}]}}]}\n\n',
            'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"bc\\"}"}}]}}]}\n\n',
            'data: {"usage":{"prompt_tokens":3,"completion_tokens":5}}\n\n',
            'data: [DONE]\n\n',
          ].join(''),
          { headers: { 'Content-Type': 'text/event-stream' } },
        )
      },
    })

    const model = createOpenAICompatModel({ baseUrl: `http://localhost:${srv.port}/v1`, model: 'test' })
    const events = await collect(
      model.reason({
        messages: [{ role: 'user', content: 'hi' }],
        signal: AbortSignal.timeout(1_000),
      }),
    )

    expect(events).toEqual([
      { type: 'thinking_delta', content: 'think' },
      { type: 'toolcall_delta', id: 'tc-1', name: 'read_file', arguments: '{"path":"a' },
      { type: 'toolcall_delta', id: 'tc-1', arguments: 'bc"}' },
      { type: 'done', response: { usage: { inputTokens: 3, outputTokens: 5 } } },
    ])
  })

  test('returns an error delta for non-ok responses', async () => {
    srv = Bun.serve({
      port: 0,
      fetch() {
        return new Response('bad request', { status: 400 })
      },
    })

    const model = createOpenAICompatModel({ baseUrl: `http://localhost:${srv.port}/v1`, model: 'test' })
    const events = await collect(
      model.reason({
        messages: [{ role: 'user', content: 'hi' }],
        signal: AbortSignal.timeout(1_000),
      }),
    )

    expect(events).toEqual([{ type: 'error', error: '400: bad request' }])
  })

  test('returns an error delta when no response body is available', async () => {
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
      const events = await collect(
        model.reason({
          messages: [{ role: 'user', content: 'hi' }],
          signal: AbortSignal.timeout(1_000),
        }),
      )

      expect(events).toEqual([{ type: 'error', error: 'No response body' }])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
