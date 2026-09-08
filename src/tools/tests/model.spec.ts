import { describe, expect, test } from 'bun:test'
import { createModelTools } from '../model.ts'
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
      expect(recorded.path).toBe('/v1/responses/compact')
      expect((recorded.body as { model?: string }).model).toBe('mock-model')
      expect((recorded.body as { prompt_cache_key?: string }).prompt_cache_key).toBe('cache-test')
    } finally {
      await server.close()
    }
  })

  test('missing-model fixture contract: 400 structured error body', async () => {
    const server = await startOpenResponsesServer()
    try {
      const res = await fetch(`${server.url}/v1/responses/compact`, {
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
