import { afterEach, describe, expect, test } from 'bun:test'
import type { ModelDelta } from '../agent.types.ts'
import { createOpenAICompatModel } from '../openai-compat.ts'

// ── Helpers ──────────────────────────────────────────────────────────

const sseResponse = (body: string) =>
  new Response(body, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' },
  })

const openaiChunk = (delta: Record<string, unknown>, extra?: Record<string, unknown>) =>
  `data: ${JSON.stringify({ choices: [{ index: 0, delta, finish_reason: null }], ...extra })}\n\n`

const collect = async (stream: AsyncIterable<ModelDelta>) => {
  const deltas: ModelDelta[] = []
  for await (const d of stream) deltas.push(d)
  return deltas
}

let server: ReturnType<typeof Bun.serve> | undefined
afterEach(() => {
  server?.stop(true)
  server = undefined
})

const createServer = (handler: (req: Request) => Response | Promise<Response>) => {
  server = Bun.serve({ port: 0, fetch: handler })
  return server
}

// ── Tests ────────────────────────────────────────────────────────────

describe('createOpenAICompatModel', () => {
  test('streams text deltas', async () => {
    const srv = createServer(() =>
      sseResponse(
        openaiChunk({ role: 'assistant', content: '' }) +
          openaiChunk({ content: 'Hello' }) +
          openaiChunk({ content: ' world' }) +
          openaiChunk({}, { usage: { prompt_tokens: 10, completion_tokens: 2 } }) +
          'data: [DONE]\n\n',
      ),
    )

    const model = createOpenAICompatModel({ baseUrl: `http://localhost:${srv.port}/v1`, model: 'test' })
    const deltas = await collect(
      model.reason({ messages: [{ role: 'user', content: 'hi' }], signal: AbortSignal.timeout(5_000) }),
    )

    const textDeltas = deltas.filter((d) => d.type === 'text_delta')
    expect(textDeltas).toEqual([
      { type: 'text_delta', content: 'Hello' },
      { type: 'text_delta', content: ' world' },
    ])

    const done = deltas.find((d) => d.type === 'done')
    expect(done).toEqual({ type: 'done', response: { usage: { inputTokens: 10, outputTokens: 2 } } })
  })

  test('streams reasoning_content as thinking_delta', async () => {
    const srv = createServer(() =>
      sseResponse(
        openaiChunk({ reasoning_content: 'Let me think...' }) +
          openaiChunk({ content: 'Answer: 42' }) +
          openaiChunk({}, { usage: { prompt_tokens: 5, completion_tokens: 3 } }) +
          'data: [DONE]\n\n',
      ),
    )

    const model = createOpenAICompatModel({ baseUrl: `http://localhost:${srv.port}/v1`, model: 'test' })
    const deltas = await collect(
      model.reason({ messages: [{ role: 'user', content: 'think' }], signal: AbortSignal.timeout(5_000) }),
    )

    expect(deltas[0]).toEqual({ type: 'thinking_delta', content: 'Let me think...' })
    expect(deltas[1]).toEqual({ type: 'text_delta', content: 'Answer: 42' })
  })

  test('streams tool call deltas with index→id tracking', async () => {
    const srv = createServer(() =>
      sseResponse(
        // First chunk: id + name
        openaiChunk({ tool_calls: [{ index: 0, id: 'call_1', function: { name: 'get_weather', arguments: '' } }] }) +
          // Subsequent chunks: arguments only (no id)
          openaiChunk({ tool_calls: [{ index: 0, function: { arguments: '{"loc' } }] }) +
          openaiChunk({ tool_calls: [{ index: 0, function: { arguments: '":"NYC"}' } }] }) +
          openaiChunk({}, { usage: { prompt_tokens: 8, completion_tokens: 10 } }) +
          'data: [DONE]\n\n',
      ),
    )

    const model = createOpenAICompatModel({ baseUrl: `http://localhost:${srv.port}/v1`, model: 'test' })
    const deltas = await collect(
      model.reason({ messages: [{ role: 'user', content: 'weather' }], signal: AbortSignal.timeout(5_000) }),
    )

    const toolDeltas = deltas.filter((d) => d.type === 'toolcall_delta')
    expect(toolDeltas[0]).toEqual({ type: 'toolcall_delta', id: 'call_1', name: 'get_weather' })
    // Subsequent chunks carry the tracked id
    expect(toolDeltas[1]).toEqual({ type: 'toolcall_delta', id: 'call_1', arguments: '{"loc' })
    expect(toolDeltas[2]).toEqual({ type: 'toolcall_delta', id: 'call_1', arguments: '":"NYC"}' })
  })

  test('retries on 429 then succeeds', async () => {
    let requestCount = 0
    const srv = createServer(() => {
      requestCount++
      if (requestCount === 1) {
        return new Response('rate limited', { status: 429, headers: { 'retry-after': '0' } })
      }
      return sseResponse(`${openaiChunk({ content: 'ok' })}data: [DONE]\n\n`)
    })

    const model = createOpenAICompatModel({ baseUrl: `http://localhost:${srv.port}/v1`, model: 'test' })
    const deltas = await collect(
      model.reason({ messages: [{ role: 'user', content: 'hi' }], signal: AbortSignal.timeout(5_000) }),
    )

    expect(requestCount).toBe(2)
    expect(deltas.some((d) => d.type === 'text_delta')).toBe(true)
  })

  test('yields error delta on server error', async () => {
    const srv = createServer(() => new Response('internal error', { status: 500 }))

    const model = createOpenAICompatModel({ baseUrl: `http://localhost:${srv.port}/v1`, model: 'test' })
    const deltas = await collect(
      model.reason({ messages: [{ role: 'user', content: 'hi' }], signal: AbortSignal.timeout(5_000) }),
    )

    expect(deltas).toHaveLength(1)
    expect(deltas[0]!.type).toBe('error')
  })

  test('sends authorization header when apiKey provided', async () => {
    let capturedAuth = ''
    const srv = createServer((req) => {
      capturedAuth = req.headers.get('authorization') ?? ''
      return sseResponse('data: [DONE]\n\n')
    })

    const model = createOpenAICompatModel({
      baseUrl: `http://localhost:${srv.port}/v1`,
      model: 'test',
      apiKey: 'sk-test-key',
    })
    await collect(model.reason({ messages: [{ role: 'user', content: 'hi' }], signal: AbortSignal.timeout(5_000) }))

    expect(capturedAuth).toBe('Bearer sk-test-key')
  })

  test('strips tags from tool definitions', async () => {
    let capturedBody: Record<string, unknown> = {}
    const srv = createServer(async (req) => {
      capturedBody = (await req.json()) as Record<string, unknown>
      return sseResponse('data: [DONE]\n\n')
    })

    const model = createOpenAICompatModel({ baseUrl: `http://localhost:${srv.port}/v1`, model: 'test' })
    await collect(
      model.reason({
        messages: [{ role: 'user', content: 'hi' }],
        tools: [
          {
            type: 'function',
            function: { name: 'read_file', description: 'Read a file' },
            tags: ['workspace'],
          },
        ],
        signal: AbortSignal.timeout(5_000),
      }),
    )

    const tools = capturedBody.tools as Array<Record<string, unknown>>
    expect(tools[0]).not.toHaveProperty('tags')
    expect((tools[0]!.function as Record<string, unknown>).name).toBe('read_file')
  })
})
