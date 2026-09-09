import { describe, expect, test } from 'bun:test'
import { createModelTools, createScriptedModelTools, DEFAULT_SCRIPTED_RESPONSE } from '../model.ts'
import type { OutputItem } from '../open-responses.schemas.ts'
import {
  ASSISTANT_TEXT,
  COMPACT_ENCRYPTED_CONTENT,
  FAILURE_MARKER,
  FUNCTION_CALL,
  startOpenResponsesServer,
} from './model-server-fixture.ts'

describe('model-respond — non-streaming', () => {
  test('round-trips items, status, and usage from a JSON ResponseResource', async () => {
    const server = await startOpenResponsesServer()
    try {
      const { modelRespond } = createModelTools({ endpoints: { mock: { url: server.url } } })
      const out = await modelRespond({
        provider: 'mock',
        modelId: 'mock-model',
        input: [{ type: 'message', role: 'user', content: 'Say hello' }],
      })
      expect(out).toHaveProperty('items')
      const success = out as { items: unknown[]; status: string; usage?: unknown; isError?: boolean }
      expect(success.isError).toBeUndefined()
      expect(success.status).toBe('completed')
      expect(success.items).toHaveLength(1)
      expect(success.items[0]).toMatchObject({ type: 'message', role: 'assistant' })
      const content = (success.items[0] as { content: Array<{ text?: string }> }).content
      expect(content[0]?.text).toBe(ASSISTANT_TEXT)
      expect(success.usage).toMatchObject({ total_tokens: 20 })

      // Wire request follows the spec: model is a string, input echoed.
      const recorded = server.requests[0]
      expect(recorded).toBeDefined()
      expect((recorded!.body as { model?: string }).model).toBe('mock-model')
      expect((recorded!.body as { input?: unknown[] }).input).toHaveLength(1)
      // No secret ever reaches the wire request when none is provisioned.
      expect(recorded!.auth).toBeNull()
    } finally {
      await server.close()
    }
  })
})

describe('model-respond — streaming', () => {
  test('buffers the event sequence in order and assembles items from output_item.done', async () => {
    const server = await startOpenResponsesServer()
    try {
      const { modelRespond } = createModelTools({ endpoints: { mock: { url: server.url } } })
      const out = await modelRespond({
        provider: 'mock',
        modelId: 'mock-model',
        input: [{ type: 'message', role: 'user', content: 'Count from 1 to 5.' }],
        stream: true,
      })
      const success = out as {
        events?: Array<{ type: string; delta?: string }>
        items: Array<{ type: string; content?: Array<{ text?: string }> }>
        status: string
        usage?: { total_tokens: number }
        isError?: boolean
      }
      expect(success.isError).toBeUndefined()
      expect(success.status).toBe('completed')

      // Events buffered in wire order, [DONE] terminated (no trailing junk).
      expect(success.events).toBeDefined()
      const types = success.events!.map((e) => e.type)
      expect(types).toEqual([
        'response.output_item.added',
        'response.output_text.delta',
        'response.output_text.delta',
        'response.output_item.done',
        'response.completed',
      ])
      const deltas = success
        .events!.filter((e) => e.type === 'response.output_text.delta')
        .map((e) => e.delta)
        .join('')
      expect(deltas).toBe(ASSISTANT_TEXT)

      // items assembled from terminal response.output_item.done events.
      expect(success.items).toHaveLength(1)
      expect(success.items[0]?.content?.[0]?.text).toBe(ASSISTANT_TEXT)
      expect(success.usage?.total_tokens).toBe(20)

      // Wire request carried stream: true.
      expect((server.requests[0]!.body as { stream?: boolean }).stream).toBe(true)
    } finally {
      await server.close()
    }
  })
})

describe('model-respond — tool-call passthrough', () => {
  test('returns a function_call item as untouched data and never executes it', async () => {
    const server = await startOpenResponsesServer()
    try {
      const { modelRespond } = createModelTools({ endpoints: { mock: { url: server.url } } })
      const out = await modelRespond({
        provider: 'mock',
        modelId: 'mock-model',
        input: [{ type: 'message', role: 'user', content: 'What is the weather in Paris?' }],
        tools: [
          {
            name: 'get_weather',
            description: 'Get the weather for a location',
            parameters: { type: 'object', properties: { location: { type: 'string' } } },
          },
        ],
      })
      const success = out as { items: Array<{ type: string; call_id?: string; arguments?: string }> }
      expect(success.items).toHaveLength(1)
      expect(success.items[0]?.type).toBe('function_call')
      expect(success.items[0]?.call_id).toBe(FUNCTION_CALL.call_id)
      expect(success.items[0]?.arguments).toBe(FUNCTION_CALL.arguments)
      // The wire request carried the tools array.
      expect((server.requests[0]!.body as { tools?: unknown[] }).tools).toHaveLength(1)
    } finally {
      await server.close()
    }
  })
})

describe('model-respond — provider routing', () => {
  test('provider label selects the right provisioned endpoint', async () => {
    const alpha = await startOpenResponsesServer()
    const beta = await startOpenResponsesServer()
    try {
      const { modelRespond } = createModelTools({
        endpoints: { alpha: { url: alpha.url }, beta: { url: beta.url } },
      })
      const out = await modelRespond({
        provider: 'beta',
        modelId: 'beta-model',
        input: [{ type: 'message', role: 'user', content: 'Hi' }],
      })
      expect(out).toHaveProperty('items')
      // Only beta got the request, carrying beta's model id.
      expect(alpha.requests).toHaveLength(0)
      expect(beta.requests).toHaveLength(1)
      expect((beta.requests[0]!.body as { model?: string }).model).toBe('beta-model')
    } finally {
      await alpha.close()
      await beta.close()
    }
  })
})

describe('model-respond — unknown provider', () => {
  test('isError with a message naming the provider', async () => {
    const server = await startOpenResponsesServer()
    try {
      const { modelRespond } = createModelTools({ endpoints: { mock: { url: server.url } } })
      const out = await modelRespond({
        provider: 'nonexistent',
        modelId: 'm',
        input: [{ type: 'message', role: 'user', content: 'Hi' }],
      })
      expect(out).toEqual({ isError: true, message: '[Error: unknown provider "nonexistent"]' })
      expect(server.requests).toHaveLength(0)
    } finally {
      await server.close()
    }
  })
})

describe('model-respond — error paths', () => {
  test('HTTP 400 with structured error body surfaces as isError', async () => {
    const server = await startOpenResponsesServer()
    try {
      const { modelRespond } = createModelTools({ endpoints: { mock: { url: server.url } } })
      const out = await modelRespond({ provider: 'mock', modelId: 'mock-model', input: [] })
      const failure = out as { isError?: boolean; message?: string }
      expect(failure.isError).toBe(true)
      expect(failure.message).toContain('400')
      expect(failure.message).toContain('invalid_request_error')
      expect(failure.message).toContain('input is required')
    } finally {
      await server.close()
    }
  })

  test('streaming response.failed passes through as status failed + error', async () => {
    const server = await startOpenResponsesServer()
    try {
      const { modelRespond } = createModelTools({ endpoints: { mock: { url: server.url } } })
      const out = await modelRespond({
        provider: 'mock',
        modelId: 'mock-model',
        input: [{ type: 'message', role: 'user', content: FAILURE_MARKER }],
        stream: true,
      })
      const failed = out as {
        isError?: boolean
        status?: string
        error?: { code: string; message: string }
        events?: Array<{ type: string }>
        items?: unknown[]
      }
      expect(failed.isError).toBeUndefined()
      expect(failed.status).toBe('failed')
      expect(failed.error?.code).toBe('context_length_exceeded')
      expect(failed.events?.at(-1)?.type).toBe('response.failed')
      expect(failed.items).toEqual([])
    } finally {
      await server.close()
    }
  })

  test('provisioned apiKey is sent as a bearer token', async () => {
    const server = await startOpenResponsesServer({ apiKey: 'sk-test-key' })
    try {
      const { modelRespond } = createModelTools({
        endpoints: { secure: { url: server.url, apiKey: 'sk-test-key' } },
      })
      const out = await modelRespond({
        provider: 'secure',
        modelId: 'mock-model',
        input: [{ type: 'message', role: 'user', content: 'Hi' }],
      })
      expect(out).toHaveProperty('items')
      expect(server.requests[0]!.auth).toBe('Bearer sk-test-key')
    } finally {
      await server.close()
    }
  })
})

describe('model-compact', () => {
  test('round-trips encrypted_content and usage', async () => {
    const server = await startOpenResponsesServer()
    try {
      const { modelCompact } = createModelTools({ endpoints: { mock: { url: server.url } } })
      const out = await modelCompact({
        provider: 'mock',
        modelId: 'mock-model',
        input: [{ type: 'message', role: 'user', content: 'We agreed to launch on Tuesday.' }],
        promptCacheKey: 'cache-test',
      })
      expect(out).toEqual({
        encrypted_content: COMPACT_ENCRYPTED_CONTENT,
        usage: { input_tokens: 100, output_tokens: 50, total_tokens: 150 },
      })
      // Wire request hit the compact endpoint with the spec body shape.
      const recorded = server.requests[0]!
      expect(recorded.path).toBe('/responses/compact')
      expect((recorded.body as { model?: string }).model).toBe('mock-model')
      expect((recorded.body as { prompt_cache_key?: string }).prompt_cache_key).toBe('cache-test')
    } finally {
      await server.close()
    }
  })

  test('missing-model fixture contract: 400 structured error body', async () => {
    const server = await startOpenResponsesServer()
    try {
      const res = await fetch(`${server.url}/responses/compact`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ input: [{ type: 'message', role: 'user', content: 'Compact this.' }] }),
      })
      expect(res.status).toBe(400)
      const body = (await res.json()) as { error?: { code?: string; message?: string } }
      expect(body.error?.code).toBe('invalid_request_error')
      expect(body.error?.message).toBe('model is required')
    } finally {
      await server.close()
    }
  })

  test('HTTP 400 from the compact endpoint surfaces as isError', async () => {
    const server = await startOpenResponsesServer()
    try {
      const { modelCompact } = createModelTools({ endpoints: { mock: { url: server.url } } })
      const out = await modelCompact({ provider: 'mock', modelId: 'mock-model', input: [] })
      const failure = out as { isError?: boolean; message?: string }
      expect(failure.isError).toBe(true)
      expect(failure.message).toContain('400')
      expect(failure.message).toContain('invalid_request_error')
    } finally {
      await server.close()
    }
  })
})

describe('createModelTools factory shape', () => {
  test('returns both tools with their registered names', () => {
    const { modelRespond, modelCompact } = createModelTools({ endpoints: {} })
    expect(modelRespond.name).toBe('model-respond')
    expect(modelCompact.name).toBe('model-compact')
  })
})

describe('createScriptedModelTools — deterministic canned model (no fetch)', () => {
  test('returns both tools with the same names as the live createModelTools', () => {
    const { modelRespond, modelCompact } = createScriptedModelTools({ script: DEFAULT_SCRIPTED_RESPONSE })
    expect(modelRespond.name).toBe('model-respond')
    expect(modelCompact.name).toBe('model-compact')
  })

  test('a single scripted response repeats on every call (no network, no fetch)', async () => {
    const { modelRespond } = createScriptedModelTools({ script: DEFAULT_SCRIPTED_RESPONSE })
    const first = await modelRespond({
      provider: 'scripted',
      modelId: 'm',
      input: [{ type: 'message', role: 'user', content: 'hi' }],
    })
    const second = await modelRespond({
      provider: 'scripted',
      modelId: 'm',
      input: [{ type: 'message', role: 'user', content: 'again' }],
    })
    expect(first).toEqual(second)
    expect((first as { status: string }).status).toBe('completed')
    expect((first as { items: unknown[] }).items).toHaveLength(1)
  })

  test('an array script advances one entry per call and clamps to the last', async () => {
    const { modelRespond } = createScriptedModelTools({
      script: [
        {
          items: [
            {
              id: 'a',
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [{ type: 'output_text', text: 'first' }],
            },
          ],
          status: 'completed',
        },
        {
          items: [
            {
              id: 'b',
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [{ type: 'output_text', text: 'second' }],
            },
          ],
          status: 'completed',
        },
      ],
    })
    const r1 = await modelRespond({
      provider: 'scripted',
      modelId: 'm',
      input: [{ type: 'message', role: 'user', content: 'x' }],
    })
    const r2 = await modelRespond({
      provider: 'scripted',
      modelId: 'm',
      input: [{ type: 'message', role: 'user', content: 'x' }],
    })
    const r3 = await modelRespond({
      provider: 'scripted',
      modelId: 'm',
      input: [{ type: 'message', role: 'user', content: 'x' }],
    })
    expect((r1 as { items: Array<{ id: string }> }).items[0]!.id).toBe('a')
    expect((r2 as { items: Array<{ id: string }> }).items[0]!.id).toBe('b')
    // Third call clamps to the last entry (second) — no out-of-bounds.
    expect((r3 as { items: Array<{ id: string }> }).items[0]!.id).toBe('b')
  })

  test('a function_call item is returned as untouched data (the caller dispatches it)', async () => {
    const { modelRespond } = createScriptedModelTools({
      script: [{ items: [FUNCTION_CALL] as unknown as OutputItem[], status: 'completed' }],
    })
    const out = await modelRespond({
      provider: 'scripted',
      modelId: 'm',
      input: [{ type: 'message', role: 'user', content: 'weather?' }],
    })
    const success = out as { items: Array<{ type: string; call_id?: string; name?: string; arguments?: string }> }
    expect(success.items).toHaveLength(1)
    expect(success.items[0]?.type).toBe('function_call')
    expect(success.items[0]?.call_id).toBe(FUNCTION_CALL.call_id)
    expect(success.items[0]?.name).toBe(FUNCTION_CALL.name)
    expect(success.items[0]?.arguments).toBe(FUNCTION_CALL.arguments)
  })

  test('usage flows through unchanged', async () => {
    const usage = { input_tokens: 7, output_tokens: 9, total_tokens: 16 }
    const { modelRespond } = createScriptedModelTools({
      script: {
        items: [
          {
            id: 'm',
            type: 'message',
            status: 'completed',
            role: 'assistant',
            content: [{ type: 'output_text', text: 'ok' }],
          },
        ],
        status: 'completed',
        usage,
      },
    })
    const out = await modelRespond({
      provider: 'scripted',
      modelId: 'm',
      input: [{ type: 'message', role: 'user', content: 'x' }],
    })
    expect((out as { usage: typeof usage }).usage).toEqual(usage)
  })

  test('modelCompact returns a canned compaction with no fetch', async () => {
    const { modelCompact } = createScriptedModelTools({ script: DEFAULT_SCRIPTED_RESPONSE })
    const out = await modelCompact({
      provider: 'scripted',
      modelId: 'm',
      input: [{ type: 'message', role: 'user', content: 'compact me' }],
    })
    expect((out as { encrypted_content: string }).encrypted_content).toBe('scripted-compaction')
  })

  test('invalid input surfaces as isError (same shape as the live tool)', async () => {
    const { modelRespond } = createScriptedModelTools({ script: DEFAULT_SCRIPTED_RESPONSE })
    const out = await modelRespond({ provider: '', modelId: '', input: [] })
    expect((out as { isError: boolean; message: string }).isError).toBe(true)
    expect((out as { message: string }).message).toContain('invalid input')
  })
})

describe('model-respond — endpoint URL join (base-with-path)', () => {
  test('appends /responses to a base-with-path endpoint (no double /v1)', async () => {
    const server = await startOpenResponsesServer()
    try {
      // Simulate a base-with-path endpoint (like OpenRouter's
      // https://openrouter.ai/api/v1) by appending a path to the fixture URL.
      const baseUrlWith = `${server.url}/api/v1`
      const { modelRespond } = createModelTools({ endpoints: { mock: { url: baseUrlWith } } })
      const out = await modelRespond({
        provider: 'mock',
        modelId: 'mock-model',
        input: [{ type: 'message', role: 'user', content: 'Say hello' }],
      })
      const success = out as { items: unknown[]; status: string; isError?: boolean }
      expect(success.isError).toBeUndefined()
      expect(success.status).toBe('completed')
      // The fixture recorded the request at /api/v1/responses (not
      // /api/v1/v1/responses — the old double-append bug).
      const recorded = server.requests[0]!
      expect(recorded.path).toBe('/api/v1/responses')
    } finally {
      await server.close()
    }
  })

  test('appends /responses/compact to a base-with-path endpoint', async () => {
    const server = await startOpenResponsesServer()
    try {
      const baseUrlWith = `${server.url}/api/v1`
      const { modelCompact } = createModelTools({ endpoints: { mock: { url: baseUrlWith } } })
      const out = await modelCompact({
        provider: 'mock',
        modelId: 'mock-model',
        input: [{ type: 'message', role: 'user', content: 'Compact this.' }],
      })
      expect((out as { encrypted_content: string }).encrypted_content).toBe(COMPACT_ENCRYPTED_CONTENT)
      const recorded = server.requests[0]!
      expect(recorded.path).toBe('/api/v1/responses/compact')
    } finally {
      await server.close()
    }
  })

  test('host-root base still works (no path prefix)', async () => {
    const server = await startOpenResponsesServer()
    try {
      const { modelRespond } = createModelTools({ endpoints: { mock: { url: server.url } } })
      const out = await modelRespond({
        provider: 'mock',
        modelId: 'mock-model',
        input: [{ type: 'message', role: 'user', content: 'Say hello' }],
      })
      const success = out as { items: unknown[]; status: string; isError?: boolean }
      expect(success.isError).toBeUndefined()
      expect(success.status).toBe('completed')
      const recorded = server.requests[0]!
      expect(recorded.path).toBe('/responses')
    } finally {
      await server.close()
    }
  })

  test('tolerates a leading reasoning item (reasoning model output)', async () => {
    const server = await startOpenResponsesServer({ withReasoning: true })
    try {
      // Simulate a reasoning model (GLM/OpenRouter-style): first output item
      // is a type:'reasoning' item with reasoning_text content, then a
      // type:'message' item with output_text content.
      const { modelRespond } = createModelTools({ endpoints: { mock: { url: server.url } } })
      const out = await modelRespond({
        provider: 'mock',
        modelId: 'mock-model',
        input: [{ type: 'message', role: 'user', content: 'Say OK' }],
      })
      const success = out as {
        items: Array<{ type: string; content?: Array<{ type: string; text?: string }> }>
        status: string
        isError?: boolean
      }
      expect(success.isError).toBeUndefined()
      expect(success.status).toBe('completed')
      // Two items: reasoning first, then the assistant message.
      expect(success.items).toHaveLength(2)
      expect(success.items[0]?.type).toBe('reasoning')
      expect(success.items[0]?.content?.[0]?.type).toBe('reasoning_text')
      expect(success.items[1]?.type).toBe('message')
      expect(success.items[1]?.content?.[0]?.type).toBe('output_text')
      expect(success.items[1]?.content?.[0]?.text).toBe(ASSISTANT_TEXT)
    } finally {
      await server.close()
    }
  })
})

describe('model-respond — reasoning item tolerance (OpenRouter/GLM)', () => {
  test('tolerates a leading reasoning output item (type: reasoning) + provider extras', async () => {
    const server = await startOpenResponsesServer({ withReasoning: true })
    try {
      const { modelRespond } = createModelTools({ endpoints: { mock: { url: server.url } } })
      const out = await modelRespond({
        provider: 'mock',
        modelId: 'mock-model',
        input: [{ type: 'message', role: 'user', content: 'Say OK' }],
      })
      const success = out as {
        items: Array<{ type: string; content?: Array<{ type: string }> }>
        status: string
        isError?: boolean
      }
      expect(success.isError).toBeUndefined()
      expect(success.status).toBe('completed')
      expect(success.items).toHaveLength(2)
    } finally {
      await server.close()
    }
  })
})

describe('model-respond — provider usage extras tolerance', () => {
  test('tolerates provider extras on the usage object (input_tokens_details, cost)', async () => {
    const server = Bun.serve({
      port: 0,
      fetch: async () =>
        Response.json({
          id: 'resp_usage_test',
          object: 'response',
          status: 'completed',
          model: 'test-model',
          output: [
            {
              id: 'msg_usage',
              type: 'message',
              status: 'completed',
              role: 'assistant',
              content: [{ type: 'output_text', text: 'OK' }],
            },
          ],
          usage: {
            input_tokens: 14,
            output_tokens: 72,
            total_tokens: 86,
            input_tokens_details: { cached_tokens: 0 },
            output_tokens_details: { reasoning_tokens: 69 },
            cost: 0.0000381,
          },
          error: null,
        }),
    })
    try {
      const { modelRespond } = createModelTools({ endpoints: { mock: { url: `http://localhost:${server.port}` } } })
      const out = await modelRespond({
        provider: 'mock',
        modelId: 'test-model',
        input: [{ type: 'message', role: 'user', content: 'Say OK' }],
      })
      const success = out as {
        items: unknown[]
        status: string
        usage?: { total_tokens: number; input_tokens_details?: unknown }
        isError?: boolean
      }
      expect(success.isError).toBeUndefined()
      expect(success.status).toBe('completed')
      expect(success.usage?.total_tokens).toBe(86)
      expect(success.usage?.input_tokens_details).toBeDefined()
    } finally {
      server.stop(true)
    }
  })
})
