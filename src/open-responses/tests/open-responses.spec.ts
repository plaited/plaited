import { describe, expect, mock, test } from 'bun:test'
import type { SnapshotMessage } from '../../behavioral/behavioral.schemas.ts'
import { behavioral } from '../../behavioral/behavioral.ts'
import { OPEN_RESPONSES_EVENTS } from '../../open-responses/open-responses.constants.ts'
import { createOpenResponsesClient } from '../../open-responses/open-responses.ts'

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const makeSseStream = (events: { event: string; data: Record<string, unknown> }[]) => {
  const encoder = new TextEncoder()
  const chunks = events.map(({ event, data }) => encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk)
      controller.close()
    },
  })
}

const createMockWebSocket = (messages: (() => Record<string, unknown>)[], received: string[]) => {
  let messageIndex = 0
  return class MockWS {
    static CONNECTING = 0 as number
    static OPEN = 1 as number
    static CLOSING = 2 as number
    static CLOSED = 3 as number
    readyState = -1 as number
    onopen: (() => void) | null = null
    onmessage: ((event: { data: string }) => void) | null = null
    onerror: (() => void) | null = null
    onclose: ((event: { code: number }) => void) | null = null

    constructor(_url: string) {
      queueMicrotask(() => this.simulateOpen())
    }

    send(data: string) {
      received.push(data)
      const parsed = JSON.parse(data)
      if (parsed.type === 'response.create') {
        queueMicrotask(() => {
          while (messageIndex < messages.length) {
            const msg = messages[messageIndex]!()
            messageIndex++
            this.simulateMessage(msg)
          }
        })
      }
    }

    close() {
      this.readyState = MockWS.CLOSED
    }

    simulateOpen() {
      this.readyState = MockWS.OPEN
      this.onopen?.()
    }
    simulateMessage(data: Record<string, unknown>) {
      this.onmessage?.({ data: JSON.stringify(data) })
    }
    simulateError() {
      this.onerror?.()
    }
    simulateClose() {
      this.readyState = MockWS.CLOSED
      this.onclose?.({ code: 1000 })
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Tier 1: HTTP transport                                            */
/* ------------------------------------------------------------------ */

describe('createOpenResponsesClient', () => {
  test('returns addHandler and trigger', () => {
    const runtime = behavioral()
    const client = createOpenResponsesClient(runtime, {
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
    })
    expect(client).toHaveProperty('addHandler')
    expect(client).toHaveProperty('trigger')
  })

  test('sync response triggers response_completed', async () => {
    const runtime = behavioral()
    const fetchMock = mock((_url: string, opts: RequestInit & { body?: string }) => {
      const parsed = JSON.parse(opts.body ?? '{}')
      expect(parsed.stream).toBeUndefined()
      return Response.json(
        {
          id: 'resp_123',
          object: 'response',
          status: 'completed',
          model: 'test-model',
          output: [
            {
              type: 'message',
              id: 'msg_1',
              role: 'assistant',
              status: 'completed',
              content: [{ type: 'output_text' as const, text: 'Hello!', annotations: [] }],
            },
          ],
          created_at: 1_000_000,
        },
        { headers: { 'content-type': 'application/json' } },
      )
    })
    createOpenResponsesClient(runtime, {
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })
    const received: unknown[] = []
    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_completed, (d) => {
      received.push(d)
    })
    runtime.trigger({ type: OPEN_RESPONSES_EVENTS.response_create, detail: { input: 'Hello' } })
    await wait(5)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(received).toHaveLength(1)
  })

  test('HTTP error triggers response_failed', async () => {
    const runtime = behavioral()
    const fetchMock = mock(() =>
      Response.json({ error: { code: 'server_error', message: 'Server error' } }, { status: 500 }),
    )
    createOpenResponsesClient(runtime, {
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })
    const received: unknown[] = []
    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_failed, (d) => {
      received.push(d)
    })
    runtime.trigger({ type: OPEN_RESPONSES_EVENTS.response_create, detail: { input: 'Hello' } })
    await wait(5)
    expect(received).toHaveLength(1)
  })

  test('SSE streaming events trigger behavioral events', async () => {
    const runtime = behavioral()
    const sseStream = makeSseStream([
      { event: 'response.created', data: { type: 'response.created', response_id: 'resp_123' } },
      {
        event: 'response.output_item.added',
        data: {
          type: 'response.output_item.added',
          item: { type: 'message', id: 'msg_1', role: 'assistant', status: 'in_progress', content: [] },
        },
      },
      {
        event: 'response.output_text.delta',
        data: { type: 'response.output_text.delta', delta: 'Hello', item_id: 'msg_1', content_index: 0 },
      },
      {
        event: 'response.completed',
        data: { type: 'response.completed', response: { id: 'resp_123', status: 'completed' } },
      },
    ])
    const fetchMock = mock(() => new Response(sseStream, { headers: { 'content-type': 'text/event-stream' } }))
    createOpenResponsesClient(runtime, {
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })
    const events: string[] = []
    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_created, () => {
      events.push('response_created')
    })
    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_output_item_added, () => {
      events.push('response_output_item_added')
    })
    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_output_text_delta, (detail) => {
      const d = detail as unknown as { delta?: string }
      events.push(`response_output_text_delta:${d.delta ?? ''}`)
    })
    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_completed, () => {
      events.push('response_completed')
    })
    runtime.trigger({ type: OPEN_RESPONSES_EVENTS.response_create, detail: { input: 'Hi', stream: true } })
    await wait(5)
    expect(events).toEqual([
      'response_created',
      'response_output_item_added',
      'response_output_text_delta:Hello',
      'response_completed',
    ])
  })

  test('tool call loop: agent submits tool_result and factory resubmits', async () => {
    const runtime = behavioral()
    const requests: unknown[] = []
    const sse1 = makeSseStream([
      {
        event: 'response.output_item.added',
        data: {
          type: 'response.output_item.added',
          item: { type: 'function_call', id: 'fc_1', name: 'get_weather', status: 'in_progress' },
        },
      },
      {
        event: 'response.function_call_arguments.done',
        data: {
          type: 'response.function_call_arguments.done',
          item_id: 'fc_1',
          name: 'get_weather',
          arguments: '{"city":"London"}',
          call_id: 'call_1',
        },
      },
      {
        event: 'response.completed',
        data: { type: 'response.completed', response: { id: 'resp_1', status: 'completed' } },
      },
    ])
    const sse2 = makeSseStream([
      {
        event: 'response.output_item.added',
        data: {
          type: 'response.output_item.added',
          item: { type: 'message', id: 'msg_2', role: 'assistant', status: 'in_progress', content: [] },
        },
      },
      {
        event: 'response.output_text.delta',
        data: { type: 'response.output_text.delta', delta: 'The weather is sunny', item_id: 'msg_2', content_index: 0 },
      },
      {
        event: 'response.completed',
        data: { type: 'response.completed', response: { id: 'resp_2', status: 'completed' } },
      },
    ])
    let callCount = 0
    const fetchMock = mock((_url: string, opts: RequestInit & { body?: string }) => {
      callCount++
      requests.push(JSON.parse(opts.body ?? '{}'))
      return callCount === 1
        ? new Response(sse1, { headers: { 'content-type': 'text/event-stream' } })
        : new Response(sse2, { headers: { 'content-type': 'text/event-stream' } })
    })
    createOpenResponsesClient(runtime, {
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
      fetch: fetchMock as unknown as typeof globalThis.fetch,
    })
    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_function_call_arguments_done, (detail) => {
      const d = detail as unknown as { call_id?: unknown }
      const call_id = typeof d.call_id === 'string' ? d.call_id : ''
      runtime.trigger({
        type: OPEN_RESPONSES_EVENTS.tool_result,
        detail: { call_id, output: JSON.stringify({ temp: 22 }) },
      })
    })
    const completed: unknown[] = []
    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_completed, (d) => {
      completed.push(d)
    })
    runtime.trigger({
      type: OPEN_RESPONSES_EVENTS.response_create,
      detail: {
        input: [{ type: 'message' as const, role: 'user', content: [{ type: 'input_text', text: 'Weather?' }] }],
        tools: [{ type: 'function' as const, name: 'get_weather', parameters: { type: 'object', properties: {} } }],
      },
    })
    await wait(20)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(completed).toHaveLength(2)
  })

  /* ------------------------------------------------------------------ */
  /*  Behavioral correctness: thread deadlock guards                    */
  /* ------------------------------------------------------------------ */

  describe('tool_loop deadlock prevention', () => {
    test('response_failed after tool_result resubmit does not deadlock', async () => {
      const runtime = behavioral()
      const deadlocks: SnapshotMessage[] = []
      runtime.useSnapshot((msg) => {
        if (msg.kind === 'deadlock') deadlocks.push(msg)
      })

      const sse1 = makeSseStream([
        {
          event: 'response.function_call_arguments.done',
          data: {
            type: 'response.function_call_arguments.done',
            call_id: 'call_1',
            name: 'test',
            arguments: '{}',
            item_id: 'fc_1',
          },
        },
      ])

      let callCount = 0
      const fetchMock = mock((_url: string, opts: RequestInit & { body?: string }) => {
        callCount++
        return callCount === 1
          ? new Response(sse1, { headers: { 'content-type': 'text/event-stream' } })
          : Response.json({ error: 'server_error' }, { status: 500 })
      })

      createOpenResponsesClient(runtime, {
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      })

      runtime.addHandler(OPEN_RESPONSES_EVENTS.response_function_call_arguments_done, () => {
        runtime.trigger({ type: OPEN_RESPONSES_EVENTS.tool_result, detail: { call_id: 'call_1', output: '{}' } })
      })

      const failed: unknown[] = []
      runtime.addHandler(OPEN_RESPONSES_EVENTS.response_failed, (d) => {
        failed.push(d)
      })

      runtime.trigger({
        type: OPEN_RESPONSES_EVENTS.response_create,
        detail: { input: 'test', tools: [{ type: 'function', name: 'test', parameters: {} }] },
      })
      await wait(20)

      expect(failed).toHaveLength(1)
      expect(deadlocks).toHaveLength(0)
    })

    test('response_incomplete does not deadlock the thread', async () => {
      const runtime = behavioral()
      const deadlocks: SnapshotMessage[] = []
      runtime.useSnapshot((msg) => {
        if (msg.kind === 'deadlock') deadlocks.push(msg)
      })

      const sse1 = makeSseStream([
        {
          event: 'response.function_call_arguments.done',
          data: {
            type: 'response.function_call_arguments.done',
            call_id: 'call_1',
            name: 'test',
            arguments: '{}',
            item_id: 'fc_1',
          },
        },
        { event: 'response.incomplete', data: { type: 'response.incomplete', reason: 'max_output_tokens' } },
      ])

      const fetchMock = mock(() => new Response(sse1, { headers: { 'content-type': 'text/event-stream' } }))

      createOpenResponsesClient(runtime, {
        baseUrl: 'https://api.test.com/v1',
        apiKey: 'test-key',
        model: 'test-model',
        fetch: fetchMock as unknown as typeof globalThis.fetch,
      })

      runtime.trigger({
        type: OPEN_RESPONSES_EVENTS.response_create,
        detail: { input: 'test', tools: [{ type: 'function', name: 'test', parameters: {} }] },
      })
      await wait(20)

      expect(deadlocks).toHaveLength(0)
    })
  })
})

/* ------------------------------------------------------------------ */
/*  Tier 2: WebSocket transport                                       */
/* ------------------------------------------------------------------ */

describe('createOpenResponsesClient WebSocket', () => {
  test('opens WS connection and sends response.create', async () => {
    const runtime = behavioral()
    const receivedMessages: string[] = []
    const MockWS = createMockWebSocket(
      [
        () => ({ type: 'response.created', response_id: 'resp_ws' }),
        () => ({ type: 'response.completed', response: { id: 'resp_ws', status: 'completed' } }),
      ],
      receivedMessages,
    )
    createOpenResponsesClient(runtime, {
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
      transport: 'websocket',
      WebSocket: MockWS as unknown as typeof globalThis.WebSocket,
    })
    const completed: unknown[] = []
    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_completed, (d) => {
      completed.push(d)
    })
    runtime.trigger({ type: OPEN_RESPONSES_EVENTS.response_create, detail: { input: 'Hello WS' } })
    await wait(10)
    expect(receivedMessages).toHaveLength(1)
    const sent = JSON.parse(receivedMessages[0]!)
    expect(sent.type).toBe('response.create')
    expect(sent.model).toBe('test-model')
    expect(sent.input).toBe('Hello WS')
    expect(completed).toHaveLength(1)
  })

  test('WS tool call loop reuses same connection', async () => {
    const runtime = behavioral()
    const receivedMessages: string[] = []
    const MockWS = createMockWebSocket(
      [
        () => ({
          type: 'response.function_call_arguments.done',
          item_id: 'fc_ws',
          name: 'get_time',
          arguments: '{}',
          call_id: 'call_ws',
        }),
        () => ({ type: 'response.completed', response: { id: 'resp_1', status: 'completed' } }),
        () => ({ type: 'response.output_text.delta', delta: 'It is 3 PM', item_id: 'msg_ws', content_index: 0 }),
        () => ({ type: 'response.completed', response: { id: 'resp_2', status: 'completed' } }),
      ],
      receivedMessages,
    )
    createOpenResponsesClient(runtime, {
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
      transport: 'websocket',
      WebSocket: MockWS as unknown as typeof globalThis.WebSocket,
    })
    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_function_call_arguments_done, (detail) => {
      const d = detail as unknown as { call_id?: unknown }
      runtime.trigger({
        type: OPEN_RESPONSES_EVENTS.tool_result,
        detail: { call_id: typeof d.call_id === 'string' ? d.call_id : '', output: '{"time":"3 PM"}' },
      })
    })
    const deltas: string[] = []
    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_output_text_delta, (detail) => {
      const d = detail as unknown as { delta?: string }
      if (d.delta) deltas.push(d.delta)
    })
    runtime.trigger({
      type: OPEN_RESPONSES_EVENTS.response_create,
      detail: { input: 'What time?', tools: [{ type: 'function', name: 'get_time', parameters: { type: 'object' } }] },
    })
    await wait(20)
    expect(receivedMessages).toHaveLength(2)
    expect(deltas).toEqual(['It is 3 PM'])
  })

  test('WS connect failure does not queue messages forever', async () => {
    const runtime = behavioral()
    const receivedMessages: string[] = []
    const createFailingMock = () =>
      class FailingWS {
        static CONNECTING = 0 as number
        static OPEN = 1 as number
        static CLOSING = 2 as number
        static CLOSED = 3 as number
        readyState = -1 as number
        onopen: (() => void) | null = null
        onerror: (() => void) | null = null
        onclose: ((event: { code: number }) => void) | null = null
        onmessage: ((event: { data: string }) => void) | null = null
        constructor(_url: string) {
          queueMicrotask(() => {
            this.onerror?.()
          })
        }
        send(_data: string) {
          receivedMessages.push(_data)
        }
        close() {}
      }

    createOpenResponsesClient(runtime, {
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
      transport: 'websocket',
      WebSocket: createFailingMock() as unknown as typeof globalThis.WebSocket,
    })

    const failed: unknown[] = []
    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_failed, (d) => {
      failed.push(d)
    })

    runtime.trigger({ type: OPEN_RESPONSES_EVENTS.response_create, detail: { input: 'hi' } })
    await wait(10)
    expect(failed).toHaveLength(1)
    // send should NOT have been called — connection never opened
    expect(receivedMessages).toHaveLength(0)
  })

  test('parallel tool calls: two function_call_arguments.done events preserved', async () => {
    const runtime = behavioral()
    const receivedMessages: string[] = []

    const MockWS = createMockWebSocket(
      [
        () => ({
          type: 'response.function_call_arguments.done',
          call_id: 'call_a',
          name: 'tool_a',
          arguments: '{}',
          item_id: 'fc_a',
        }),
        () => ({
          type: 'response.function_call_arguments.done',
          call_id: 'call_b',
          name: 'tool_b',
          arguments: '{}',
          item_id: 'fc_b',
        }),
        () => ({ type: 'response.completed', response: { id: 'resp_1', status: 'completed' } }),
        () => ({ type: 'response.output_text.delta', delta: 'Done', item_id: 'msg_2', content_index: 0 }),
        () => ({ type: 'response.completed', response: { id: 'resp_2', status: 'completed' } }),
      ],
      receivedMessages,
    )

    createOpenResponsesClient(runtime, {
      baseUrl: 'https://api.test.com/v1',
      apiKey: 'test-key',
      model: 'test-model',
      transport: 'websocket',
      WebSocket: MockWS as unknown as typeof globalThis.WebSocket,
    })

    runtime.addHandler(OPEN_RESPONSES_EVENTS.response_function_call_arguments_done, (detail) => {
      const d = detail as unknown as { call_id?: string }
      runtime.trigger({
        type: OPEN_RESPONSES_EVENTS.tool_result,
        detail: { call_id: d.call_id ?? '', output: `result_${d.call_id}` },
      })
    })

    runtime.trigger({
      type: OPEN_RESPONSES_EVENTS.response_create,
      detail: {
        input: 'do both',
        tools: [
          { type: 'function', name: 'tool_a', parameters: {} },
          { type: 'function', name: 'tool_b', parameters: {} },
        ],
      },
    })
    await wait(30)

    // Three WS messages: initial create + two tool_result resubmissions
    expect(receivedMessages.length).toBe(3)
    // Final resubmission (second tool_result) should include BOTH function_call + output items
    const final = JSON.parse(receivedMessages[2]!)
    const input = final.input as unknown[]
    expect(input.length).toBeGreaterThanOrEqual(4)
  })
})
