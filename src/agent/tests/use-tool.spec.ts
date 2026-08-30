import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import type { Trace } from '../../main/behavioral.schemas.ts'
import { behavioral } from '../../main/behavioral.ts'
import type { AddHandler, AddThread, Trigger } from '../../main/behavioral.types.ts'
import type { KnownStreamEvent, OpenResponsesRequest } from '../open-responses.schemas.ts'
import { registerAgentThreads } from '../threads.ts'
import { useResponse } from '../use-response.ts'
import type { ToolDescriptor } from '../use-tool.ts'
import { useTool } from '../use-tool.ts'

// ================================================================
// Test helpers
// ================================================================

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

/**
 * Create a fresh behavioral program and return its hooks + a trace collector.
 * Registration of the agent loop threads is done separately.
 */
const createBP = () => {
  const bp = behavioral<never>()
  const { useAddThread, useAddHandler, useTrigger, useTrace } = bp

  const addThread = useAddThread() as AddThread
  const addHandler = useAddHandler() as AddHandler
  const trigger = useTrigger() as Trigger

  const selected: string[] = []
  useTrace((msg: Trace) => {
    if (msg.kind === 'selection') {
      selected.push(msg.selected.type)
    }
  })

  return { addHandler, addThread, trigger, selected }
}

// ================================================================
// Scenario: single tool call
// ================================================================
const singleToolEvents: KnownStreamEvent[] = [
  {
    type: 'response.output_item.added',
    item: {
      id: 'fc_1',
      type: 'function_call',
      status: 'in_progress',
      call_id: 'call_abc',
      name: 'get_weather',
      arguments: '',
    },
  },
  {
    type: 'response.function_call_arguments.delta',
    item_id: 'fc_1',
    output_index: 0,
    delta: '{"location": "Paris"}',
  },
  {
    type: 'response.output_item.done',
    output_index: 0,
    item: {
      id: 'fc_1',
      type: 'function_call',
      status: 'completed',
      call_id: 'call_abc',
      name: 'get_weather',
      arguments: '{"location": "Paris"}',
    },
  },
  {
    type: 'response.completed',
    status: 'completed',
  },
]

const weatherFollowUp: KnownStreamEvent[] = [
  {
    type: 'response.output_item.added',
    item: {
      id: 'msg_2',
      type: 'message',
      status: 'in_progress',
      role: 'assistant',
      content: [],
    },
  },
  {
    type: 'response.output_text.delta',
    item_id: 'msg_2',
    output_index: 0,
    content_index: 0,
    delta: 'The weather is sunny in Paris.',
  },
  {
    type: 'response.output_item.done',
    output_index: 0,
    item: {
      id: 'msg_2',
      type: 'message',
      status: 'completed',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'The weather is sunny in Paris.' }],
    },
  },
  {
    type: 'response.completed',
    status: 'completed',
  },
]

// ================================================================
// Scenario: two parallel same-tool calls
// ================================================================
const parallelToolEvents: KnownStreamEvent[] = [
  {
    type: 'response.output_item.added',
    item: {
      id: 'fc_a',
      type: 'function_call',
      status: 'in_progress',
      call_id: 'call_a',
      name: 'get_weather',
      arguments: '',
    },
  },
  {
    type: 'response.output_item.added',
    item: {
      id: 'fc_b',
      type: 'function_call',
      status: 'in_progress',
      call_id: 'call_b',
      name: 'get_weather',
      arguments: '',
    },
  },
  {
    type: 'response.function_call_arguments.delta',
    item_id: 'fc_a',
    output_index: 0,
    delta: '{"location": "London"}',
  },
  {
    type: 'response.function_call_arguments.delta',
    item_id: 'fc_b',
    output_index: 0,
    delta: '{"location": "Tokyo"}',
  },
  {
    type: 'response.output_item.done',
    output_index: 0,
    item: {
      id: 'fc_a',
      type: 'function_call',
      status: 'completed',
      call_id: 'call_a',
      name: 'get_weather',
      arguments: '{"location": "London"}',
    },
  },
  {
    type: 'response.output_item.done',
    output_index: 1,
    item: {
      id: 'fc_b',
      type: 'function_call',
      status: 'completed',
      call_id: 'call_b',
      name: 'get_weather',
      arguments: '{"location": "Tokyo"}',
    },
  },
  {
    type: 'response.completed',
    status: 'completed',
  },
]

// ================================================================
// Scenario: malformed arguments
// ================================================================
const badArgsToolEvents: KnownStreamEvent[] = [
  {
    type: 'response.output_item.added',
    item: {
      id: 'fc_bad',
      type: 'function_call',
      status: 'in_progress',
      call_id: 'call_bad',
      name: 'get_weather',
      arguments: '',
    },
  },
  {
    type: 'response.function_call_arguments.delta',
    item_id: 'fc_bad',
    output_index: 0,
    delta: '{"loc": 42}',
  },
  {
    type: 'response.output_item.done',
    output_index: 0,
    item: {
      id: 'fc_bad',
      type: 'function_call',
      status: 'completed',
      call_id: 'call_bad',
      name: 'get_weather',
      arguments: '{"loc": 42}',
    },
  },
  {
    type: 'response.completed',
    status: 'completed',
  },
]

// ================================================================
// Scenario: unknown tool name
// ================================================================
const unknownToolEvents: KnownStreamEvent[] = [
  {
    type: 'response.output_item.added',
    item: {
      id: 'fc_unk',
      type: 'function_call',
      status: 'in_progress',
      call_id: 'call_unk',
      name: 'unknown_tool',
      arguments: '',
    },
  },
  {
    type: 'response.function_call_arguments.delta',
    item_id: 'fc_unk',
    output_index: 0,
    delta: '{}',
  },
  {
    type: 'response.output_item.done',
    output_index: 0,
    item: {
      id: 'fc_unk',
      type: 'function_call',
      status: 'completed',
      call_id: 'call_unk',
      name: 'unknown_tool',
      arguments: '{}',
    },
  },
  {
    type: 'response.completed',
    status: 'completed',
  },
]

// ================================================================
// Tests — done-when criteria
// ================================================================

describe('useTool — valid tool call', () => {
  test('valid get_weather call triggers get_weather_result and tool.result with call_id', async () => {
    let callCount = 0
    const adapter = useResponse({
      provider: 'test-single',
      respond: async function* (_req: OpenResponsesRequest) {
        if (callCount === 0) {
          callCount++
          yield* singleToolEvents
        } else {
          callCount++
          yield* weatherFollowUp
        }
      },
    })

    const hooks = createBP()
    const tools: ToolDescriptor[] = [
      useTool(
        { addHandler: hooks.addHandler, trigger: hooks.trigger },
        {
          name: 'get_weather',
          inputSchema: z.object({ location: z.string() }),
          outputSchema: z.object({ temperature: z.number(), conditions: z.string() }),
          run: async (_input) => {
            return { temperature: 72, conditions: 'sunny' }
          },
        },
      ),
    ]
    registerAgentThreads(
      { addThread: hooks.addThread, addHandler: hooks.addHandler, trigger: hooks.trigger },
      adapter,
      tools,
    )

    hooks.trigger({ type: 'user.prompt', detail: { prompt: 'What is the weather in Paris?' } })

    for (let i = 0; i < 12; i++) {
      await tick()
    }

    expect(hooks.selected).toContain('get_weather')
    expect(hooks.selected).toContain('get_weather_result')
    expect(hooks.selected).toContain('tool.result')
    expect(hooks.selected).toContain('turn.end')
  })
})

describe('useTool — parallel same-tool calls', () => {
  test('two parallel same-tool calls correlate by call_id', async () => {
    const adapter = useResponse({
      provider: 'test-parallel',
      respond: async function* () {
        yield* parallelToolEvents
      },
    })

    const hooks = createBP()
    const results: Array<{ call_id: string; output: string; event: string }> = []

    const tools: ToolDescriptor[] = [
      useTool(
        { addHandler: hooks.addHandler, trigger: hooks.trigger },
        {
          name: 'get_weather',
          inputSchema: z.object({ location: z.string() }),
          outputSchema: z.object({ temperature: z.number(), conditions: z.string() }),
          run: async (_input) => {
            if (_input.location === 'London') return { temperature: 60, conditions: 'cloudy' }
            if (_input.location === 'Tokyo') return { temperature: 85, conditions: 'humid' }
            return { temperature: 70, conditions: 'fair' }
          },
        },
      ),
    ]
    registerAgentThreads(
      { addThread: hooks.addThread, addHandler: hooks.addHandler, trigger: hooks.trigger },
      adapter,
      tools,
    )

    // Tap into get_weather_result to capture call_id correlation
    hooks.addHandler('get_weather_result', ({ detail }) => {
      const { call_id, output } = (detail ?? {}) as { call_id: string; output: string }
      results.push({ call_id, output, event: 'get_weather_result' })
    })

    // Tap into tool.result to verify both events carry call_id
    hooks.addHandler('tool.result', ({ detail }) => {
      const { call_id, output } = (detail ?? {}) as { call_id: string; output: string }
      results.push({ call_id, output, event: 'tool.result' })
    })

    hooks.trigger({ type: 'user.prompt', detail: { prompt: 'Weather in London and Tokyo?' } })

    for (let i = 0; i < 12; i++) {
      await tick()
    }

    // 4 results: 2 get_weather_result + 2 tool.result
    expect(results.length).toBe(4)

    // Group by call_id
    const byCallId = new Map<string, typeof results>()
    for (const r of results) {
      const group = byCallId.get(r.call_id) ?? []
      group.push(r)
      byCallId.set(r.call_id, group)
    }

    expect(byCallId.size).toBe(2)
    expect(byCallId.has('call_a')).toBe(true)
    expect(byCallId.has('call_b')).toBe(true)

    // Each call_id should have both a _result and a tool.result event
    for (const [, group] of byCallId) {
      const eventTypes = group.map((r) => r.event)
      expect(eventTypes).toContain('get_weather_result')
      expect(eventTypes).toContain('tool.result')
    }

    // Verify the outputs match the locations
    const callA = byCallId.get('call_a')!
    const callB = byCallId.get('call_b')!
    const outputA = JSON.parse(callA[0]!.output)
    const outputB = JSON.parse(callB[0]!.output)
    const conditions = [outputA.conditions, outputB.conditions]
    expect(conditions).toContain('cloudy')
    expect(conditions).toContain('humid')
  })
})

describe('useTool — malformed call blocking', () => {
  test('malformed arguments produce tool_call_blocked and error tool.result', async () => {
    const adapter = useResponse({
      provider: 'test-bad-args',
      respond: async function* () {
        yield* badArgsToolEvents
      },
    })

    const hooks = createBP()
    const tools: ToolDescriptor[] = [
      useTool(
        { addHandler: hooks.addHandler, trigger: hooks.trigger },
        {
          name: 'get_weather',
          inputSchema: z.object({ location: z.string() }),
          outputSchema: z.object({ temperature: z.number(), conditions: z.string() }),
          run: async (_input) => {
            return { temperature: 72, conditions: 'sunny' }
          },
        },
      ),
    ]
    registerAgentThreads(
      { addThread: hooks.addThread, addHandler: hooks.addHandler, trigger: hooks.trigger },
      adapter,
      tools,
    )

    hooks.trigger({ type: 'user.prompt', detail: { prompt: 'Weather?' } })

    for (let i = 0; i < 12; i++) {
      await tick()
    }

    expect(hooks.selected).toContain('tool_call_blocked')
    expect(hooks.selected).toContain('tool.result')
    // The tool event should NOT fire (blocked)
    expect(hooks.selected).not.toContain('get_weather')
    expect(hooks.selected).not.toContain('get_weather_result')
  })

  test('unknown tool name produces tool_call_blocked and error tool.result', async () => {
    const adapter = useResponse({
      provider: 'test-unknown',
      respond: async function* () {
        yield* unknownToolEvents
      },
    })

    const hooks = createBP()
    const tools: ToolDescriptor[] = [
      useTool(
        { addHandler: hooks.addHandler, trigger: hooks.trigger },
        {
          name: 'get_weather',
          inputSchema: z.object({ location: z.string() }),
          outputSchema: z.object({ temperature: z.number(), conditions: z.string() }),
          run: async (_input) => {
            return { temperature: 72, conditions: 'sunny' }
          },
        },
      ),
    ]
    registerAgentThreads(
      { addThread: hooks.addThread, addHandler: hooks.addHandler, trigger: hooks.trigger },
      adapter,
      tools,
    )

    hooks.trigger({ type: 'user.prompt', detail: { prompt: 'Weather?' } })

    for (let i = 0; i < 12; i++) {
      await tick()
    }

    expect(hooks.selected).toContain('tool_call_blocked')
    expect(hooks.selected).toContain('tool.result')
  })
})

describe('useTool — purity check', () => {
  test('schema containing top-level call_id is rejected at registration', () => {
    const hooks = createBP()

    // inputSchema with call_id property
    expect(() =>
      useTool(
        { addHandler: hooks.addHandler, trigger: hooks.trigger },
        {
          name: 'bad_tool',
          inputSchema: z.object({ location: z.string(), call_id: z.string() }),
          outputSchema: z.object({ result: z.string() }),
          run: async () => ({ result: 'ok' }),
        },
      ),
    ).toThrow('call_id')

    // outputSchema with call_id
    expect(() =>
      useTool(
        { addHandler: hooks.addHandler, trigger: hooks.trigger },
        {
          name: 'bad_tool_2',
          inputSchema: z.object({ location: z.string() }),
          outputSchema: z.object({ result: z.string(), call_id: z.string().optional() }),
          run: async () => ({ result: 'ok' }),
        },
      ),
    ).toThrow('call_id')
  })

  test('name "_result" suffix is rejected', () => {
    const hooks = createBP()
    expect(() =>
      useTool(
        { addHandler: hooks.addHandler, trigger: hooks.trigger },
        {
          name: 'my_tool_result',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          run: async () => ({}),
        },
      ),
    ).toThrow('_result')
  })

  test('name "tool.result" is rejected', () => {
    const hooks = createBP()
    expect(() =>
      useTool(
        { addHandler: hooks.addHandler, trigger: hooks.trigger },
        {
          name: 'tool.result',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          run: async () => ({}),
        },
      ),
    ).toThrow('tool.result')
  })

  test('returned ToolDescriptor is frozen with expected shape', () => {
    const hooks = createBP()
    const td = useTool(
      { addHandler: hooks.addHandler, trigger: hooks.trigger },
      {
        name: 'echo',
        inputSchema: z.object({ msg: z.string() }),
        outputSchema: z.object({ msg: z.string() }),
        run: async (input) => ({ msg: input.msg }),
        description: 'echo test',
      },
    )

    expect(td.name).toBe('echo')
    expect(td.description).toBe('echo test')
    expect(td.jsonSchema).toBeDefined()
    expect(td.jsonSchema.type).toBe('object')
    expect((td.jsonSchema.properties as Record<string, unknown>).msg).toBeDefined()
    // Should be frozen
    expect(() => {
      ;(td as Record<string, unknown>).name = 'changed'
    }).toThrow()
  })
})
