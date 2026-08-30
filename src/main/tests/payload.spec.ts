import { describe, expect, test } from 'bun:test'
import type { Trace } from '../behavioral.schemas.ts'
import { BPEventSchema } from '../behavioral.schemas.ts'
import { behavioral } from '../behavioral.ts'

describe('payload channel', () => {
  test('delivers non-JSON payload to handler as the third argument', () => {
    const { useAddThread, useTrigger, useAddHandler } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()

    const payload = new Blob(['hello'])
    let receivedPayload: unknown = null
    let receivedDetail: unknown = null

    addThread({ label: 'producer', rules: [{ request: { type: 'upload', detail: { name: 'file.txt' } } }], once: true })
    addHandler<{ name: string }>('upload', ({ detail, payload }) => {
      receivedDetail = detail
      receivedPayload = payload
    })

    // An ingress trigger carries the opaque payload straight to the handler.
    trigger({ type: 'upload', detail: { name: 'file.txt' }, payload })

    expect(receivedDetail).toEqual({ name: 'file.txt' })
    expect(receivedPayload).toBe(payload)
  })

  test('payload is absent from every Trace variant when selected', () => {
    const traces: Trace[] = []
    const { useAddThread, useTrigger, useAddHandler, useTrace } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    useTrace((msg) => {
      traces.push(msg)
    })

    const payload = { fn: () => {} }

    addThread({ label: 'producer', rules: [{ request: { type: 'work', detail: { id: 1 } } }], once: true })
    addHandler('work', () => {
      throw new Error('boom')
    })

    trigger({ type: 'work', detail: { id: 1 }, payload })

    // Assert every trace message is JSON-only: no `payload` key anywhere.
    for (const trace of traces) {
      const hasPayloadKey = Object.hasOwn(trace, 'payload')
      expect(hasPayloadKey).toBe(false)

      // Recursively guard nested objects (candidates, enabled, selected, threads).
      const found = JSON.stringify(trace, (_k, v) => (typeof v === 'function' ? '<fn>' : v))
      expect(found).not.toContain('<fn>')
    }

    // Sanity: the non-JSON payload never leaked into the selection's detail.
    const selection = traces.find((s) => s.kind === 'selection')
    expect(selection).toBeDefined()
    const selected = (selection as Extract<Trace, { kind: 'selection' }>).selected
    expect(Object.hasOwn(selected, 'payload')).toBe(false)

    // Sanity: feedback_error fired (proves the handler ran with payload).
    const errors = traces.filter((s) => s.kind === 'feedback_error')
    expect(errors).toHaveLength(1)
    const err = errors[0] as Extract<Trace, { kind: 'feedback_error' }>
    expect(Object.hasOwn(err, 'payload')).toBe(false)
  })

  test('BPEventSchema carries payload as a separate key from detail', () => {
    // Direct schema parse: payload is its own key, not merged into detail
    const event = {
      type: 'work',
      detail: { id: 1, name: 'test' },
      payload: new Blob(['binary']),
    }

    const parsed = BPEventSchema.parse(event)

    expect(parsed).toHaveProperty('detail')
    expect(parsed).toHaveProperty('payload')
    expect(parsed.detail).toEqual({ id: 1, name: 'test' })
    expect(parsed.payload).toBeInstanceOf(Blob)
    // Payload did not leak into detail
    expect(Object.keys(parsed.detail!)).not.toContain('payload')
    // Detail did not leak into payload
    expect(parsed.payload).not.toHaveProperty('id')
  })

  test('thread request payload survives request→selection→handler cycle as a separate key from detail', () => {
    // A thread's request rule carries both detail and payload.
    // The payload must reach the handler separately — not merged into detail.
    const { useAddThread, useTrigger, useAddHandler } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()

    const payload = new Blob(['work-data'])
    let receivedDetail: unknown = null
    let receivedPayload: unknown = null

    addThread({
      label: 'worker',
      rules: [{ request: { type: 'work', detail: { id: 1 }, payload } }],
      once: true,
    })

    addHandler<{ id: number }>('work', ({ detail, payload }) => {
      receivedDetail = detail
      receivedPayload = payload
    })

    // Kick the program so the thread's request is selected
    trigger({ type: 'kick' })

    expect(receivedDetail).toEqual({ id: 1 })
    expect(receivedPayload).toBe(payload)
    // Payload is NOT part of detail
    expect(receivedDetail).not.toHaveProperty('payload')
  })

  test('payload never participates in matching (detail-only)', () => {
    const { useAddThread, useTrigger, useAddHandler } = behavioral()
    const addThread = useAddThread()
    const trigger = useTrigger()
    const addHandler = useAddHandler()
    const log: string[] = []

    // waiter waits for a task with matching detail; payload differs but must still match
    addThread({ label: 'waiter', rules: [{ waitFor: [{ type: 'task' }] }, { request: { type: 'ack' } }], once: true })
    addHandler('task', () => {
      log.push('task')
    })
    addHandler('ack', () => {
      log.push('ack')
    })

    trigger({ type: 'task', detail: { id: 1 }, payload: new Blob(['a']) })

    expect(log).toEqual(['task', 'ack'])
  })
})
