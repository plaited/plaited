import { describe, expect, test } from 'bun:test'
import { behavioral } from '../behavioral.ts'

/**
 * Handler lifecycle.
 *
 * The plan (`plan.md` Phase -1) keeps exactly two handler-removal paths:
 * the engine-side `useEject` sweep, and the *caller-held* `Disconnect` returned
 * by `addHandler`. The handler itself never receives a self-removal handle —
 * coordination (what stays, what goes) lives in b-threads, not in side-effect
 * callbacks. These tests lock down the caller-held path so the param removal
 * (dropping `disconnect` from `Handler<T>`) cannot regress it.
 */
describe('addHandler caller-held disconnect', () => {
  test('the returned disconnect stops the handler from firing on later events', () => {
    const received: string[] = []
    const { useTrigger, useAddHandler } = behavioral()
    const trigger = useTrigger()
    const addHandler = useAddHandler()

    const disconnect = addHandler('ping', () => {
      received.push('ping')
    })

    trigger({ type: 'ping' })
    expect(received).toEqual(['ping'])

    // Caller tears the handler down between super-steps — no self-disconnect
    // from inside the handler is involved.
    disconnect()

    trigger({ type: 'ping' })
    expect(received).toEqual(['ping'])
  })

  test('disconnecting one handler leaves sibling handlers intact', () => {
    const received: string[] = []
    const { useTrigger, useAddHandler } = behavioral()
    const trigger = useTrigger()
    const addHandler = useAddHandler()

    const disconnectA = addHandler('ping', () => {
      received.push('a')
    })
    addHandler('ping', () => {
      received.push('b')
    })

    trigger({ type: 'ping' })
    expect(received).toEqual(['a', 'b'])

    disconnectA()

    trigger({ type: 'ping' })
    expect(received).toEqual(['a', 'b', 'b'])
  })
})

/**
 * useAddHandler topic-scoping: an optional `topic` argument filters the
 * handler to selected events carrying the same `topic`. Omitting `topic`
 * preserves the legacy type-only match (fires for any topic).
 *
 * A selected event's topic is stamped by `useTrigger(topic)` (on injected
 * events) and by `useAddThread(topic)` (on thread-requested events).
 */
describe('useAddHandler topic scoping', () => {
  test('scoped handler fires for a same-topic triggered event and skips other topics', () => {
    const received: string[] = []
    const { useTrigger, useAddHandler } = behavioral()
    const triggerA = useTrigger('topicA')

    useAddHandler('topicA')('event', () => {
      received.push('topicA')
    })
    useAddHandler('topicB')('event', () => {
      received.push('topicB')
    })
    // Unscoped handler still fires (back-compat type-only match).
    useAddHandler()('event', () => {
      received.push('unscoped')
    })

    triggerA({ type: 'event' })

    expect(received).toEqual(['topicA', 'unscoped'])
  })

  test('scoped handler ignores triggered events that carry no topic', () => {
    const received: string[] = []
    const { useTrigger, useAddHandler } = behavioral()
    const trigger = useTrigger()

    useAddHandler('topicA')('event', () => {
      received.push('topicA')
    })
    useAddHandler()('event', () => {
      received.push('unscoped')
    })

    trigger({ type: 'event' })

    expect(received).toEqual(['unscoped'])
  })

  test('topic propagates from useAddThread to a requested event and gates scoped handlers', () => {
    const received: string[] = []
    const { useAddThread, useTrigger, useAddHandler } = behavioral()
    const addThread = useAddThread('topicA')
    const trigger = useTrigger()

    // Producer under topicA requests 'event' — the selected event carries topicA.
    addThread({ label: 'producer', rules: [{ request: { type: 'event' } }], once: true })

    useAddHandler('topicA')('event', () => {
      received.push('topicA')
    })
    useAddHandler('topicB')('event', () => {
      received.push('topicB')
    })
    useAddHandler()('event', () => {
      received.push('unscoped')
    })

    // Catalyst kick: 'go' is ingress (priority 0), selected first and unhandled;
    // the next super-step selects the producer's topicA 'event' request.
    trigger({ type: 'go' })

    expect(received).toEqual(['topicA', 'unscoped'])
  })
})
