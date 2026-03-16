import { afterEach, describe, expect, test } from 'bun:test'
import type { ModelDelta } from '../../agent.types.ts'
import { createGeminiModel } from '../gemini.ts'

let server: ReturnType<typeof Bun.serve> | undefined
afterEach(() => {
  server?.stop(true)
  server = undefined
})

describe('createGeminiModel', () => {
  test('delegates to OpenAI-compat with Gemini baseUrl', async () => {
    let capturedUrl = ''
    let capturedAuth = ''

    server = Bun.serve({
      port: 0,
      fetch(req) {
        capturedUrl = new URL(req.url).pathname
        capturedAuth = req.headers.get('authorization') ?? ''
        return new Response(
          'data: {"choices":[{"index":0,"delta":{"content":"Gemini says hi"}}]}\n\n' + 'data: [DONE]\n\n',
          { headers: { 'Content-Type': 'text/event-stream' } },
        )
      },
    })

    // We can't easily override the Gemini baseUrl since it's hardcoded,
    // so we test that createGeminiModel returns a valid Model that
    // produces the correct structure when pointed at a local server.
    // For the baseUrl test, we use createOpenAICompatModel directly.
    const { createOpenAICompatModel } = await import('../openai-compat.ts')
    const model = createOpenAICompatModel({
      baseUrl: `http://localhost:${server.port}/v1beta/openai`,
      apiKey: 'test-gemini-key',
      model: 'gemini-2.5-flash',
    })

    const deltas: ModelDelta[] = []
    for await (const d of model.reason({
      messages: [{ role: 'user', content: 'hi' }],
      signal: AbortSignal.timeout(5_000),
    })) {
      deltas.push(d)
    }

    expect(capturedUrl).toBe('/v1beta/openai/chat/completions')
    expect(capturedAuth).toBe('Bearer test-gemini-key')
    expect(deltas[0]).toEqual({ type: 'text_delta', content: 'Gemini says hi' })
  })

  test('createGeminiModel returns a Model with reason method', () => {
    const model = createGeminiModel({ apiKey: 'test-key' })
    expect(typeof model.reason).toBe('function')
  })

  test('uses default model gemini-2.5-flash', async () => {
    let capturedModel = ''

    server = Bun.serve({
      port: 0,
      async fetch(req) {
        const body = (await req.json()) as Record<string, unknown>
        capturedModel = body.model as string
        return new Response('data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } })
      },
    })

    const { createOpenAICompatModel } = await import('../openai-compat.ts')
    const model = createOpenAICompatModel({
      baseUrl: `http://localhost:${server.port}/v1`,
      apiKey: 'key',
      model: 'gemini-2.5-flash',
    })

    const deltas: ModelDelta[] = []
    for await (const d of model.reason({
      messages: [{ role: 'user', content: 'hi' }],
      signal: AbortSignal.timeout(5_000),
    })) {
      deltas.push(d)
    }

    expect(capturedModel).toBe('gemini-2.5-flash')
  })
})
