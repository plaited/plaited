import { describe, expect, test } from 'bun:test'
import type { Trace } from '../../main/behavioral.schemas.ts'
import { behavioral } from '../../main/behavioral.ts'
import type { AddHandler, AddThread, Trigger } from '../../main/behavioral.types.ts'
import type { ToolArgs } from '../../tools/tool.types.ts'
import { defineTool } from '../define-tool.ts'

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
  return { addThread, addHandler, trigger, selected }
}

const echoTool: ToolArgs = {
  name: 'echo',
  inputSchema: {
    type: 'object',
    properties: { msg: { type: 'string' } },
    required: ['msg'],
    additionalProperties: false,
  },
  outputSchema: {
    type: 'object',
    properties: { msg: { type: 'string' } },
    required: ['msg'],
    additionalProperties: false,
  },
  run: async (input) => ({ output: { msg: (input as { msg: string }).msg } }),
  description: 'echo test',
}

describe('defineTool — registration', () => {
  test('returns a frozen ToolDescriptor with the declared shape', () => {
    const { addThread, addHandler, trigger } = createBP()
    const td = defineTool(echoTool)({ addHandler, trigger, addThread })
    expect(td.name).toBe('echo')
    expect(td.description).toBe('echo test')
    expect(Object.isFrozen(td)).toBe(true)
  })

  test('rejects an inputSchema that is not a valid JSON Schema document', () => {
    const { addThread, addHandler, trigger } = createBP()
    // No JSON Schema keyword present — fails the JsonSchemaObjectSchema refine.
    expect(() =>
      defineTool({ ...echoTool, inputSchema: { random: 'object' } })({ addHandler, trigger, addThread }),
    ).toThrow('inputSchema')
  })

  test('rejects an outputSchema that is not a valid JSON Schema document', () => {
    const { addThread, addHandler, trigger } = createBP()
    expect(() =>
      defineTool({ ...echoTool, outputSchema: { random: 'object' } })({ addHandler, trigger, addThread }),
    ).toThrow('outputSchema')
  })
})

describe('defineTool — handler dispatch', () => {
  test('a valid tool event runs the handler and triggers tool.result with call_id + item_id', async () => {
    const { addThread, addHandler, trigger } = createBP()
    defineTool(echoTool)({ addHandler, trigger, addThread })

    const results: Array<{ call_id: string; output: string; item_id?: string }> = []
    addHandler('tool.result', ({ detail }) => {
      const d = (detail ?? {}) as { call_id: string; output: string; item_id?: string }
      results.push({ call_id: d.call_id, output: d.output, item_id: d.item_id })
    })

    trigger({
      type: 'echo',
      detail: { call_id: 'call_1', arguments: { msg: 'hi' }, item_id: 'item_1' },
    })
    for (let i = 0; i < 6; i++) await tick()

    expect(results).toHaveLength(1)
    expect(results[0]!.call_id).toBe('call_1')
    expect(results[0]!.item_id).toBe('item_1')
    expect(JSON.parse(results[0]!.output)).toEqual({ msg: 'hi' })
  })

  test('output that violates the declared outputSchema throws (feedback_error, not model data)', async () => {
    const bp = behavioral()
    const addThread = bp.useAddThread() as AddThread
    const addHandler = bp.useAddHandler() as AddHandler
    const trigger = bp.useTrigger() as Trigger
    const traces: Trace[] = []
    bp.useTrace((m) => {
      traces.push(m)
    })

    const badTool: ToolArgs = {
      name: 'bad',
      inputSchema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] },
      outputSchema: {
        type: 'object',
        properties: { ok: { type: 'boolean' } },
        required: ['ok'],
        additionalProperties: false,
      },
      run: async () => ({ output: { wrong: true } }),
    }
    defineTool(badTool)({ addHandler, trigger, addThread })

    const results: string[] = []
    addHandler('tool.result', () => {
      results.push('tool.result')
    })

    trigger({ type: 'bad', detail: { call_id: 'c', arguments: { x: 's' }, item_id: 'i' } })
    for (let i = 0; i < 6; i++) await tick()

    expect(results).toEqual([])
    expect(traces.some((t) => t.kind === 'feedback_error')).toBe(true)
  })
})

describe('defineTool — no guard thread registered', () => {
  test('only the handler is wired (no BLOCK_INVALID_TOOL_CALL thread)', () => {
    const bp = behavioral()
    const addThread = bp.useAddThread() as AddThread
    const addHandler = bp.useAddHandler() as AddHandler
    const trigger = bp.useTrigger() as Trigger
    const traces: Trace[] = []
    bp.useTrace((m) => {
      traces.push(m)
    })

    defineTool(echoTool)({ addHandler, trigger, addThread })

    // Dispatch-time validation (kernel.ts) is the sole schema gate; defineTool
    // adds no block listener and calls addThread zero times, so no
    // add_thread_error trace can appear regardless of arg shape.
    trigger({ type: 'echo', detail: { call_id: 'c', arguments: {}, item_id: 'i' } })
    expect(traces.some((t) => t.kind === 'add_thread_error')).toBe(false)
  })
})
