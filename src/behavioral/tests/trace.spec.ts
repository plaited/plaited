import { describe, expect, test } from 'bun:test'
import type { Trace } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'

const onType = (type: string) => ({ type })

describe('useTrace', () => {
  test('does not alter event selection order', () => {
    const events: string[] = []
    const { useAddThread, useTrigger, useAddHandler, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()

    // Subscribe to traces — this should not affect event ordering
    useTrace(() => {})

    addThread({ label: 'producer', rules: [{ request: { type: 'task' } }], once: true })
    addThread({ label: 'consumer', rules: [{ waitFor: [onType('task')] }, { request: { type: 'ack' } }], once: true })

    addHandler('task', () => {
      events.push('task')
    })
    addHandler('ack', () => {
      events.push('ack')
    })

    trigger({ type: 'kickoff' })

    expect(events).toEqual(['task', 'ack'])
  })

  test('second listener still receives after first disconnects', () => {
    const tracesA: Trace[] = []
    const tracesB: Trace[] = []
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()

    const disconnectA = useTrace((msg: Trace) => {
      tracesA.push(msg)
    })
    useTrace((msg: Trace) => {
      tracesB.push(msg)
    })

    addThread({ label: 'req', rules: [{ request: { type: 'ping' } }], once: true })

    // Both listeners receive the first selection trace
    trigger({ type: 'start' })
    expect(tracesA.length).toBeGreaterThan(0)
    expect(tracesB.length).toBeGreaterThan(0)

    const countA = tracesA.length
    const countB = tracesB.length

    // Disconnect listener A
    disconnectA()

    // Set up a new thread and trigger again
    addThread({ label: 'req2', rules: [{ request: { type: 'pong' } }], once: true })
    trigger({ type: 'go' })

    // A should not have received any new messages
    expect(tracesA.length).toBe(countA)
    // B should still be receiving
    expect(tracesB.length).toBeGreaterThan(countB)
  })

  test('re-subscribing after full disconnect still works', () => {
    const tracesA: Trace[] = []
    const tracesB: Trace[] = []
    const { useAddThread, useTrigger, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()

    const disconnectA = useTrace((msg: Trace) => {
      tracesA.push(msg)
    })
    const disconnectB = useTrace((msg: Trace) => {
      tracesB.push(msg)
    })

    addThread({ label: 'req', rules: [{ request: { type: 'ping' } }], once: true })
    trigger({ type: 'start' })

    // Both received
    expect(tracesA.length).toBeGreaterThan(0)
    expect(tracesB.length).toBeGreaterThan(0)

    // Disconnect both
    disconnectA()
    disconnectB()

    // Re-subscribe — publisher is always available
    const tracesC: Trace[] = []
    useTrace((msg: Trace) => {
      tracesC.push(msg)
    })

    addThread({ label: 'req2', rules: [{ request: { type: 'pong' } }], once: true })
    trigger({ type: 'go' })

    expect(tracesC.length).toBeGreaterThan(0)
  })
})

describe('sendTrace', () => {
  test('injects an extension event that useTrace listeners receive', () => {
    type AgentEvent = { kind: 'tool_call'; timestamp: number; tool: string }
    const received: Array<Trace | AgentEvent> = []
    const { useTrace, sendTrace } = behavioral<AgentEvent>()

    useTrace((msg) => {
      received.push(msg)
    })

    const event: AgentEvent = { kind: 'tool_call', timestamp: Date.now(), tool: 'edit_file' }
    sendTrace(event)

    // The injected extension event is delivered to the listener
    expect(received).toContainEqual(event)
  })

  test('extension events interleave with engine traces in publication order', () => {
    type AgentEvent = { kind: 'tool_call'; timestamp: number; tool: string }
    const received: Array<Trace | AgentEvent> = []
    const { useAddThread, useTrigger, useTrace, sendTrace } = behavioral<AgentEvent>()
    const addThread = useAddThread()
    const trigger = useTrigger()

    useTrace((msg) => {
      received.push(msg)
    })

    addThread({ label: 'req', rules: [{ request: { type: 'ping' } }], once: true })
    trigger({ type: 'start' })

    // Engine has published pending_bids/frontier/selection traces; now inject.
    const engineCount = received.length
    expect(engineCount).toBeGreaterThan(0)

    const agentEvent: AgentEvent = { kind: 'tool_call', timestamp: Date.now(), tool: 'read' }
    sendTrace(agentEvent)

    // The injected event arrives after the engine traces
    expect(received[received.length - 1]).toEqual(agentEvent)
    expect(received.length).toBe(engineCount + 1)
  })

  test('multiple listeners all receive injected extension events', () => {
    type AgentEvent = { kind: 'agent_message'; timestamp: number; content: string }
    const a: Array<Trace | AgentEvent> = []
    const b: Array<Trace | AgentEvent> = []
    const { useTrace, sendTrace } = behavioral<AgentEvent>()

    useTrace((msg) => {
      a.push(msg)
    })
    useTrace((msg) => {
      b.push(msg)
    })

    const event: AgentEvent = { kind: 'agent_message', timestamp: Date.now(), content: 'hello' }
    sendTrace(event)

    expect(a).toContainEqual(event)
    expect(b).toContainEqual(event)
  })

  test('injected extension events do not affect event selection', () => {
    type AgentEvent = { kind: 'tool_call'; timestamp: number; tool: string }
    const selected: string[] = []
    const { useAddThread, useTrigger, useAddHandler, useTrace, sendTrace } = behavioral<AgentEvent>()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()

    useTrace(() => {})

    addThread({ label: 'producer', rules: [{ request: { type: 'task' } }], once: true })
    addThread({ label: 'consumer', rules: [{ waitFor: [onType('task')] }, { request: { type: 'ack' } }], once: true })
    addHandler('task', () => {
      selected.push('task')
    })
    addHandler('ack', () => {
      selected.push('ack')
    })

    // Inject an extension event before triggering — it must not participate in selection
    sendTrace({ kind: 'tool_call', timestamp: Date.now(), tool: 'noop' })
    trigger({ type: 'kickoff' })

    expect(selected).toEqual(['task', 'ack'])
  })

  test('without an extension, sendTrace is not callable (type-level)', () => {
    const { sendTrace } = behavioral()
    // @ts-expect-error - default T = never; sendTrace arg is never, so any call is a type error
    sendTrace({ kind: 'tool_call', timestamp: 0, tool: 'x' })
    // Confirm at runtime that sendTrace exists on the API surface
    expect(typeof sendTrace).toBe('function')
  })

  test('sendTrace rejects engine Trace variants (type-level)', () => {
    type AgentEvent = { kind: 'tool_call'; timestamp: number; tool: string }
    const { sendTrace } = behavioral<AgentEvent>()
    // @ts-expect-error - engine Trace variant is NOT a valid sendTrace arg (kind mismatch)
    sendTrace({ kind: 'selection', timestamp: 0, step: 0, selected: { type: 'x' } })
    // Confirm at runtime that sendTrace exists on the API surface
    expect(typeof sendTrace).toBe('function')
  })
})
