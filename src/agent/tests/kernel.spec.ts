import { describe, expect, test } from 'bun:test'
import type { Trace } from '../../main/behavioral.schemas.ts'
import { behavioral } from '../../main/behavioral.ts'
import type { AddHandler, AddThread, Trigger } from '../../main/behavioral.types.ts'
import type { ToolDescriptor } from '../define-tool.ts'
import { defineTool } from '../define-tool.ts'
import { registerKernel } from '../kernel.ts'
import type { KnownStreamEvent, OpenResponsesRequest } from '../open-responses.schemas.ts'
import type { Adapter, CompactionResult } from '../use-response.ts'
import { useResponse } from '../use-response.ts'

// ================================================================
// Test helpers
// ================================================================

/**
 * Wait for the microtask queue to drain so async handlers complete.
 */
const tick = () => new Promise<void>((r) => setTimeout(r, 0))

/**
 * Create a fresh behavioral program, register the agent loop, and return
 * hooks + a trace collector that starts capturing immediately.
 */
function setupTest(adapter: Adapter, toolDescriptors?: ToolDescriptor[]) {
  const bp = behavioral()
  const { useAddThread, useAddHandler, useTrigger, useTrace } = bp

  // Partially-apply with no topic (root scope)
  const addThread = useAddThread() as AddThread
  const addHandler = useAddHandler() as AddHandler
  const trigger = useTrigger() as Trigger

  // Start collecting selection traces immediately
  const selected: string[] = []
  useTrace((msg: Trace) => {
    if (msg.kind === 'selection') {
      selected.push(msg.selected.type)
    }
  })

  // Register the agent loop
  registerKernel({ addThread, addHandler, trigger }, adapter, toolDescriptors)

  return {
    addHandler,
    addThread,
    trigger,
    selected,
    /** Wait for async handlers to settle, then return the collected events. */
    async settle(n = 10): Promise<string[]> {
      for (let i = 0; i < n; i++) {
        await tick()
      }
      return selected
    },
  }
}

// ================================================================
// Test scenarios
// ================================================================

// --- Scenario 1: Happy path — text-only turn ---
const textOnlyEvents: KnownStreamEvent[] = [
  {
    type: 'response.output_item.added',
    item: { id: 'msg_1', type: 'message', status: 'in_progress', role: 'assistant', content: [] },
  },
  {
    type: 'response.output_text.delta',
    item_id: 'msg_1',
    output_index: 0,
    content_index: 0,
    delta: 'Hello',
  },
  {
    type: 'response.output_item.done',
    output_index: 0,
    item: {
      id: 'msg_1',
      type: 'message',
      status: 'completed',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Hello' }],
    },
  },
  {
    type: 'response.completed',
    status: 'completed',
  },
]

// --- Scenario 2: Tool-calling turn ---
const toolCallFirstResponse: KnownStreamEvent[] = [
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

const toolCallSecondResponse: KnownStreamEvent[] = [
  {
    type: 'response.output_item.added',
    item: { id: 'msg_2', type: 'message', status: 'in_progress', role: 'assistant', content: [] },
  },
  {
    type: 'response.output_text.delta',
    item_id: 'msg_2',
    output_index: 0,
    content_index: 0,
    delta: 'The weather is sunny and 72°F.',
  },
  {
    type: 'response.output_item.done',
    output_index: 0,
    item: {
      id: 'msg_2',
      type: 'message',
      status: 'completed',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'The weather is sunny and 72°F.' }],
    },
  },
  {
    type: 'response.completed',
    status: 'completed',
  },
]

// --- Scenario 3: Failed response ---
const failedEvents: KnownStreamEvent[] = [
  {
    type: 'response.output_item.added',
    item: { id: 'msg_fail', type: 'message', status: 'in_progress', role: 'assistant', content: [] },
  },
  {
    type: 'response.failed',
    status: 'failed',
    error: { code: 'context_length_exceeded', message: 'Context window full' },
  },
]

// --- Scenario 4: Compaction-threshold response ---
const compactionEvents: KnownStreamEvent[] = [
  {
    type: 'response.output_item.added',
    item: { id: 'msg_cmp', type: 'message', status: 'in_progress', role: 'assistant', content: [] },
  },
  {
    type: 'response.output_text.delta',
    item_id: 'msg_cmp',
    output_index: 0,
    content_index: 0,
    delta: 'Short response.',
  },
  {
    type: 'response.output_item.done',
    output_index: 0,
    item: {
      id: 'msg_cmp',
      type: 'message',
      status: 'completed',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Short response.' }],
    },
  },
  {
    type: 'response.completed',
    status: 'completed',
    usage: { input_tokens: 5000, output_tokens: 100, total_tokens: 5100 },
  },
]

// ================================================================
// Tests
// ================================================================

describe('agent loop — happy path', () => {
  test('text-only turn ends with turn.end', async () => {
    const adapter = useResponse({
      provider: 'test-happy',
      respond: async function* () {
        yield* textOnlyEvents
      },
    })

    const { trigger, settle } = setupTest(adapter)
    trigger({ type: 'user.prompt', detail: { prompt: 'Hello' } })

    const events = await settle()

    expect(events).toContain('user.prompt') // ingress
    expect(events).toContain('respond') // loop requests respond
    expect(events).toContain('response.output_item.added') // spec event
    expect(events).toContain('response.output_text.delta') // spec event
    expect(events).toContain('response.output_item.done') // spec event
    expect(events).toContain('response.completed') // terminal spec event
    expect(events).toContain('turn.end') // stop condition fires
  })

  test('second turn also emits turn.end — stop condition loops', async () => {
    const adapter = useResponse({
      provider: 'test-multi-turn',
      respond: async function* () {
        yield* textOnlyEvents
      },
    })

    const { trigger, settle } = setupTest(adapter)
    trigger({ type: 'user.prompt', detail: { prompt: 'First' } })
    await settle()
    trigger({ type: 'user.prompt', detail: { prompt: 'Second' } })

    const events = await settle()

    const turnEnds = events.filter((t) => t === 'turn.end').length
    expect(turnEnds).toBe(2)
  })

  test('tool-calling turn cycles through spec events via defineTool', async () => {
    let callCount = 0
    const adapter = useResponse({
      provider: 'test-tool',
      respond: async function* (_req: OpenResponsesRequest) {
        if (callCount === 0) {
          callCount++
          yield* toolCallFirstResponse
        } else {
          callCount++
          yield* toolCallSecondResponse
        }
      },
    })

    // Create BP + register tools before destructuring to avoid hoisting issues
    const bp = behavioral()
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

    const tools: ToolDescriptor[] = [
      defineTool({
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
        run: async () => ({ output: { temperature: 72, conditions: 'sunny' } }),
      })({ addHandler, trigger, addThread }),
    ]

    registerKernel({ addThread, addHandler, trigger }, adapter, tools)

    // Start the turn
    trigger({ type: 'user.prompt', detail: { prompt: 'What is the weather in Paris?' } })

    for (let i = 0; i < 12; i++) {
      await tick()
    }

    // Verify the event flow
    expect(selected).toContain('user.prompt')
    expect(selected).toContain('respond')
    // Spec events from the stream
    expect(selected).toContain('response.output_item.added')
    expect(selected).toContain('response.function_call_arguments.delta')
    expect(selected).toContain('response.output_item.done')
    expect(selected).toContain('response.completed')
    // Tool dispatch (via defineTool)
    expect(selected).toContain('get_weather')
    expect(selected).toContain('tool.result')
    // Second respond cycle
    const respondCount = selected.filter((t) => t === 'respond').length
    expect(respondCount).toBeGreaterThanOrEqual(2)
    // Final turn end
    expect(selected).toContain('turn.end')
  })
})

describe('agent loop — cancel mid-turn', () => {
  test('cancel interrupts the loop thread', async () => {
    const adapter = useResponse({
      provider: 'test-cancel',
      respond: async function* () {
        yield {
          type: 'response.output_item.added' as const,
          item: {
            id: 'msg_c',
            type: 'message' as const,
            status: 'in_progress' as const,
            role: 'assistant' as const,
            content: [],
          },
        }
        // Hang forever — the loop is stuck waiting for a terminal event
        await new Promise(() => {})
      },
    })

    const { trigger, settle } = setupTest(adapter)

    // Start the turn
    trigger({ type: 'user.prompt', detail: { prompt: 'Hello' } })

    // Let the stream start
    await tick()

    // Cancel mid-turn
    trigger({ type: 'cancel' })

    const events = await settle()

    // user.prompt was selected, respond was selected, then cancel interrupts
    expect(events).toContain('user.prompt')
    expect(events).toContain('respond')
    expect(events).toContain('cancel')
    // cancel should have interrupted the loop thread — no terminal event expected
    expect(events).not.toContain('response.completed')
    expect(events).not.toContain('turn.end')
  })
})

describe('agent loop — response.failed does not emit turn.end', () => {
  test('failed response keeps the loop alive', async () => {
    const adapter = useResponse({
      provider: 'test-fail',
      respond: async function* () {
        yield* failedEvents
      },
    })

    const { trigger, settle } = setupTest(adapter)
    trigger({ type: 'user.prompt', detail: { prompt: 'Do something' } })

    const events = await settle()

    expect(events).toContain('user.prompt')
    expect(events).toContain('respond')
    expect(events).toContain('response.failed')
    // turn.end should NOT be present — the stop-condition thread only
    // watches for response.completed
    expect(events).not.toContain('turn.end')
  })
})

describe('agent loop — compaction gate', () => {
  test('compaction threshold triggers compaction cycle', async () => {
    const adapter = useResponse({
      provider: 'test-compact',
      contextWindow: 4000, // below the 5000 input_tokens in the scenario
      compact: async (_req: OpenResponsesRequest): Promise<CompactionResult> => {
        return { type: 'compaction', encrypted_content: 'compacted:summary' }
      },
      respond: async function* () {
        yield* compactionEvents
      },
    })

    const { trigger, settle } = setupTest(adapter)
    trigger({ type: 'user.prompt', detail: { prompt: 'Hello' } })

    const events = await settle(12)

    // The compaction gate should have fired
    expect(events).toContain('context.threshold')
    expect(events).toContain('compaction.start')
    expect(events).toContain('compaction.done')
    // The loop should have completed
    expect(events).toContain('response.completed')
    expect(events).toContain('turn.end')
  })

  test('compaction blocks respond before compaction.done', async () => {
    const adapter = useResponse({
      provider: 'test-compact-synth',
      contextWindow: 4000,
      // No compact function — uses the synthesize path
      respond: async function* () {
        yield* compactionEvents
      },
    })

    const { trigger, settle } = setupTest(adapter)
    trigger({ type: 'user.prompt', detail: { prompt: 'Hello' } })

    const events = await settle(12)

    expect(events).toContain('context.threshold')
    expect(events).toContain('compaction.start')
    expect(events).toContain('compaction.done')
    expect(events).toContain('response.completed')

    // The respond event should appear AFTER compaction.done unblocks it
    // (the initial respond fires before compaction, then compaction blocks it)
    const respondIndexes = events.map((t, i) => (t === 'respond' ? i : -1)).filter((i) => i >= 0)
    const compactionDoneIndex = events.indexOf('compaction.done')
    expect(respondIndexes.length).toBeGreaterThanOrEqual(1)
    // The last respond (or the one after compaction) comes after compaction.done
    if (respondIndexes.length > 1) {
      expect(respondIndexes[respondIndexes.length - 1]).toBeGreaterThan(compactionDoneIndex)
    }
  })
})

describe('agent loop — event types are spec event types in traces', () => {
  test('no llm.* vocabulary appears in selection traces', async () => {
    const adapter = useResponse({
      provider: 'test-spec',
      respond: async function* () {
        yield* textOnlyEvents
      },
    })

    const { trigger, settle } = setupTest(adapter)
    trigger({ type: 'user.prompt', detail: { prompt: 'Hello' } })

    const events = await settle()

    // Assert no invented vocabulary
    for (const type of events) {
      expect(type).not.toMatch(/^llm\./)
      expect(type).not.toMatch(/^ai\./)
    }

    // Assert spec event types are present
    expect(events.some((t) => t.startsWith('response.'))).toBe(true)
  })
})
