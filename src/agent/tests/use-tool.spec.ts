import { describe, expect, test } from 'bun:test'
import type { Trace } from '../../main/behavioral.schemas.ts'
import { behavioral } from '../../main/behavioral.ts'
import type { AddHandler, AddThread, Trigger } from '../../main/behavioral.types.ts'
import type { ToolArgs } from '../../tools/tool.types.ts'
import type { ToolDescriptor } from '../define-tool.ts'
import { defineTool } from '../define-tool.ts'
import { registerKernel } from '../kernel.ts'
import type { KnownStreamEvent, OpenResponsesRequest } from '../open-responses.schemas.ts'
import { useResponse } from '../use-response.ts'

// ================================================================
// Test helpers
// ================================================================

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

const createBP = () => {
  const bp = behavioral()
  const addThread = bp.useAddThread() as AddThread
  const addHandler = bp.useAddHandler() as AddHandler
  const trigger = bp.useTrigger() as Trigger
  const selected: string[] = []
  bp.useTrace((msg: Trace) => {
    if (msg.kind === 'selection') selected.push(msg.selected.type)
  })
  return { addHandler, addThread, trigger, selected }
}

const weatherTool: ToolArgs = {
  name: 'get_weather',
  inputSchema: {
    type: 'object',
    properties: { location: { type: 'string' } },
    required: ['location'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: { temperature: { type: 'number' }, conditions: { type: 'string' } },
    required: ['temperature', 'conditions'],
    additionalProperties: false,
  },
  run: async (input) => {
    const { location } = input as { location: string }
    if (location === 'London') return { output: { temperature: 60, conditions: 'cloudy' } }
    if (location === 'Tokyo') return { output: { temperature: 85, conditions: 'humid' } }
    return { output: { temperature: 72, conditions: 'sunny' } }
  },
}

const register = (hooks: ReturnType<typeof createBP>) =>
  defineTool(weatherTool)({ addHandler: hooks.addHandler, trigger: hooks.trigger, addThread: hooks.addThread })

// ================================================================
// Scenarios
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
  { type: 'response.completed', status: 'completed' },
]

const weatherFollowUp: KnownStreamEvent[] = [
  {
    type: 'response.output_item.added',
    item: { id: 'msg_2', type: 'message', status: 'in_progress', role: 'assistant', content: [] },
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
  { type: 'response.completed', status: 'completed' },
]

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
  { type: 'response.completed', status: 'completed' },
]

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
  { type: 'response.completed', status: 'completed' },
]

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
  { type: 'response.completed', status: 'completed' },
]

// ================================================================
// Tests
// ================================================================

describe('defineTool dispatch — valid tool call', () => {
  test('valid get_weather call triggers tool.result with call_id', async () => {
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
    const tools: ToolDescriptor[] = [register(hooks)]
    registerKernel({ addThread: hooks.addThread, addHandler: hooks.addHandler, trigger: hooks.trigger }, adapter, tools)

    hooks.trigger({ type: 'user.prompt', detail: { prompt: 'What is the weather in Paris?' } })

    for (let i = 0; i < 12; i++) await tick()

    expect(hooks.selected).toContain('get_weather')
    expect(hooks.selected).toContain('tool.result')
    expect(hooks.selected).toContain('turn.end')
  })
})

describe('defineTool dispatch — parallel same-tool calls', () => {
  test('two parallel same-tool calls correlate by call_id', async () => {
    const adapter = useResponse({
      provider: 'test-parallel',
      respond: async function* () {
        yield* parallelToolEvents
      },
    })

    const hooks = createBP()
    const results: Array<{ call_id: string; output: string }> = []

    const tools: ToolDescriptor[] = [register(hooks)]
    registerKernel({ addThread: hooks.addThread, addHandler: hooks.addHandler, trigger: hooks.trigger }, adapter, tools)

    hooks.addHandler('tool.result', ({ detail }) => {
      const { call_id, output } = (detail ?? {}) as { call_id: string; output: string }
      results.push({ call_id, output })
    })

    hooks.trigger({ type: 'user.prompt', detail: { prompt: 'Weather in London and Tokyo?' } })

    for (let i = 0; i < 12; i++) await tick()

    // 2 tool.result events, one per call_id
    expect(results).toHaveLength(2)
    const byCallId = new Map(results.map((r) => [r.call_id, r]))
    expect(byCallId.has('call_a')).toBe(true)
    expect(byCallId.has('call_b')).toBe(true)
    const conditions = [JSON.parse(byCallId.get('call_a')!.output), JSON.parse(byCallId.get('call_b')!.output)]
    expect(conditions.map((c) => c.conditions)).toContain('cloudy')
    expect(conditions.map((c) => c.conditions)).toContain('humid')
  })
})

describe('defineTool dispatch — malformed call blocking', () => {
  test('malformed arguments produce tool_call_blocked and error tool.result', async () => {
    const adapter = useResponse({
      provider: 'test-bad-args',
      respond: async function* () {
        yield* badArgsToolEvents
      },
    })

    const hooks = createBP()
    const tools: ToolDescriptor[] = [register(hooks)]
    registerKernel({ addThread: hooks.addThread, addHandler: hooks.addHandler, trigger: hooks.trigger }, adapter, tools)

    hooks.trigger({ type: 'user.prompt', detail: { prompt: 'Weather?' } })

    for (let i = 0; i < 12; i++) await tick()

    expect(hooks.selected).toContain('tool_call_blocked')
    expect(hooks.selected).toContain('tool.result')
    // The tool event should NOT fire (blocked)
    expect(hooks.selected).not.toContain('get_weather')
  })

  test('unknown tool name produces tool_call_blocked and error tool.result', async () => {
    const adapter = useResponse({
      provider: 'test-unknown',
      respond: async function* () {
        yield* unknownToolEvents
      },
    })

    const hooks = createBP()
    const tools: ToolDescriptor[] = [register(hooks)]
    registerKernel({ addThread: hooks.addThread, addHandler: hooks.addHandler, trigger: hooks.trigger }, adapter, tools)

    hooks.trigger({ type: 'user.prompt', detail: { prompt: 'Weather?' } })

    for (let i = 0; i < 12; i++) await tick()

    expect(hooks.selected).toContain('tool_call_blocked')
    expect(hooks.selected).toContain('tool.result')
  })
})

describe('defineTool — schema validation', () => {
  test('rejects an inputSchema that is not a valid JSON Schema document', () => {
    const hooks = createBP()
    expect(() =>
      defineTool({ ...weatherTool, inputSchema: { random: 'object' } })({
        addHandler: hooks.addHandler,
        trigger: hooks.trigger,
        addThread: hooks.addThread,
      }),
    ).toThrow('inputSchema')
  })

  test('rejects an outputSchema that is not a valid JSON Schema document', () => {
    const hooks = createBP()
    expect(() =>
      defineTool({ ...weatherTool, outputSchema: { random: 'object' } })({
        addHandler: hooks.addHandler,
        trigger: hooks.trigger,
        addThread: hooks.addThread,
      }),
    ).toThrow('outputSchema')
  })

  test('returned ToolDescriptor is frozen with expected shape', () => {
    const hooks = createBP()
    const td = defineTool(weatherTool)({
      addHandler: hooks.addHandler,
      trigger: hooks.trigger,
      addThread: hooks.addThread,
    })
    expect(td.name).toBe('get_weather')
    expect(Object.isFrozen(td)).toBe(true)
  })
})
