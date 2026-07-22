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

    // Subscribe to snapshots — this should not affect event ordering
    useTrace(() => {})

    addThread('producer', { rules: [{ request: { type: 'task' } }], once: true })
    addThread('consumer', {
      rules: [{ waitFor: [onType('task')] }, { request: { type: 'ack' } }],
      once: true,
    })

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

    addThread('req', { rules: [{ request: { type: 'ping' } }], once: true })

    // Both listeners receive the first selection trace
    trigger({ type: 'start' })
    expect(tracesA.length).toBeGreaterThan(0)
    expect(tracesB.length).toBeGreaterThan(0)

    const countA = tracesA.length
    const countB = tracesB.length

    // Disconnect listener A
    disconnectA()

    // Set up a new thread and trigger again
    addThread('req2', { rules: [{ request: { type: 'pong' } }], once: true })
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

    addThread('req', { rules: [{ request: { type: 'ping' } }], once: true })
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

    addThread('req2', { rules: [{ request: { type: 'pong' } }], once: true })
    trigger({ type: 'go' })

    expect(tracesC.length).toBeGreaterThan(0)
  })
})
