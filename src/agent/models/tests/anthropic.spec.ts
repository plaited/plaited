import { afterEach, describe, expect, test } from 'bun:test'
import Anthropic from '@anthropic-ai/sdk'
import type { ModelDelta } from '../../agent.types.ts'

// ── Helpers ──────────────────────────────────────────────────────────

/** Build an Anthropic-format SSE response body from events */
const anthropicSSE = (events: Array<{ event: string; data: Record<string, unknown> }>) =>
  events.map((e) => `event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`).join('')

/** Standard message_start event */
const messageStart = (inputTokens = 10) => ({
  event: 'message_start',
  data: {
    type: 'message_start',
    message: {
      id: 'msg_01',
      type: 'message',
      role: 'assistant',
      content: [],
      model: 'claude-sonnet-4-6',
      usage: { input_tokens: inputTokens, output_tokens: 0 },
    },
  },
})

/** Standard message_delta + message_stop events */
const messageEnd = (outputTokens = 5) => [
  {
    event: 'message_delta',
    data: { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: outputTokens } },
  },
  { event: 'message_stop', data: { type: 'message_stop' } },
]

let server: ReturnType<typeof Bun.serve> | undefined
afterEach(() => {
  server?.stop(true)
  server = undefined
})

/**
 * Creates a Model-compatible generator backed by the Anthropic SDK
 * pointed at a mock server. This mirrors the logic in anthropic.ts
 * but with a configurable client baseURL for testing.
 */
const collectFromMockServer = async (port: number) => {
  const client = new Anthropic({ apiKey: 'test-key', baseURL: `http://localhost:${port}` })
  const toolUseBlocks = new Map<number, string>()
  const deltas: ModelDelta[] = []
  const signal = AbortSignal.timeout(5_000)

  try {
    const stream = client.messages.stream(
      { model: 'claude-sonnet-4-6', max_tokens: 4096, messages: [{ role: 'user', content: 'test' }] },
      { signal },
    )

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          toolUseBlocks.set(event.index, event.content_block.id)
          deltas.push({ type: 'toolcall_delta', id: event.content_block.id, name: event.content_block.name })
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'thinking_delta') {
          deltas.push({ type: 'thinking_delta', content: event.delta.thinking })
        } else if (event.delta.type === 'text_delta') {
          deltas.push({ type: 'text_delta', content: event.delta.text })
        } else if (event.delta.type === 'input_json_delta') {
          const id = toolUseBlocks.get(event.index)
          if (id) deltas.push({ type: 'toolcall_delta', id, arguments: event.delta.partial_json })
        }
      }
    }

    const final = await stream.finalMessage()
    deltas.push({
      type: 'done',
      response: { usage: { inputTokens: final.usage.input_tokens, outputTokens: final.usage.output_tokens } },
    })
  } catch (err) {
    if (signal.aborted) throw err
    deltas.push({ type: 'error', error: err instanceof Error ? err.message : String(err) })
  }

  return deltas
}

// ── Tests ────────────────────────────────────────────────────────────

describe('createAnthropicModel', () => {
  test('streams text deltas', async () => {
    server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(
          anthropicSSE([
            messageStart(),
            {
              event: 'content_block_start',
              data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
            },
            {
              event: 'content_block_delta',
              data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hello world' } },
            },
            { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
            ...messageEnd(5),
          ]),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    })

    const deltas = await collectFromMockServer(server.port!)
    expect(deltas[0]).toEqual({ type: 'text_delta', content: 'Hello world' })
    expect(deltas[1]).toEqual({ type: 'done', response: { usage: { inputTokens: 10, outputTokens: 5 } } })
  })

  test('streams tool use deltas', async () => {
    server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(
          anthropicSSE([
            messageStart(),
            {
              event: 'content_block_start',
              data: {
                type: 'content_block_start',
                index: 0,
                content_block: { type: 'tool_use', id: 'toolu_01', name: 'get_weather' },
              },
            },
            {
              event: 'content_block_delta',
              data: {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'input_json_delta', partial_json: '{"location"' },
              },
            },
            {
              event: 'content_block_delta',
              data: {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'input_json_delta', partial_json: ':"NYC"}' },
              },
            },
            { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
            ...messageEnd(15),
          ]),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    })

    const deltas = await collectFromMockServer(server.port!)
    const toolDeltas = deltas.filter((d) => d.type === 'toolcall_delta')
    expect(toolDeltas[0]).toEqual({ type: 'toolcall_delta', id: 'toolu_01', name: 'get_weather' })
    expect(toolDeltas[1]).toEqual({ type: 'toolcall_delta', id: 'toolu_01', arguments: '{"location"' })
    expect(toolDeltas[2]).toEqual({ type: 'toolcall_delta', id: 'toolu_01', arguments: ':"NYC"}' })
  })

  test('streams thinking deltas', async () => {
    server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(
          anthropicSSE([
            messageStart(),
            {
              event: 'content_block_start',
              data: { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
            },
            {
              event: 'content_block_delta',
              data: {
                type: 'content_block_delta',
                index: 0,
                delta: { type: 'thinking_delta', thinking: 'Let me reason...' },
              },
            },
            { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
            {
              event: 'content_block_start',
              data: { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
            },
            {
              event: 'content_block_delta',
              data: { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'The answer is 42' } },
            },
            { event: 'content_block_stop', data: { type: 'content_block_stop', index: 1 } },
            ...messageEnd(20),
          ]),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    })

    const deltas = await collectFromMockServer(server.port!)
    expect(deltas[0]).toEqual({ type: 'thinking_delta', content: 'Let me reason...' })
    expect(deltas[1]).toEqual({ type: 'text_delta', content: 'The answer is 42' })
  })

  test('yields error on API failure', async () => {
    server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(
          JSON.stringify({ type: 'error', error: { type: 'authentication_error', message: 'Invalid key' } }),
          { status: 401, headers: { 'Content-Type': 'application/json' } },
        ),
    })

    const deltas = await collectFromMockServer(server.port!)
    expect(deltas.some((d) => d.type === 'error')).toBe(true)
  })

  test('reports usage in done delta', async () => {
    server = Bun.serve({
      port: 0,
      fetch: () =>
        new Response(
          anthropicSSE([
            messageStart(100),
            {
              event: 'content_block_start',
              data: { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
            },
            {
              event: 'content_block_delta',
              data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi' } },
            },
            { event: 'content_block_stop', data: { type: 'content_block_stop', index: 0 } },
            ...messageEnd(50),
          ]),
          { headers: { 'Content-Type': 'text/event-stream' } },
        ),
    })

    const deltas = await collectFromMockServer(server.port!)
    const done = deltas.find((d) => d.type === 'done')
    expect(done).toBeDefined()
    if (done?.type === 'done') {
      expect(done.response.usage.inputTokens).toBe(100)
      expect(done.response.usage.outputTokens).toBe(50)
    }
  })

  test('createAnthropicModel factory returns valid Model', async () => {
    const { createAnthropicModel } = await import('../anthropic.ts')
    const model = createAnthropicModel({ apiKey: 'test-key' })
    expect(typeof model.reason).toBe('function')
  })
})
