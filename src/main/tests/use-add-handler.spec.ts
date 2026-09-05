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
 * useAddHandler space-scoping: an optional `space` argument filters the
 * handler to selected events carrying the same `space`. Omitting `space`
 * preserves the legacy type-only match (fires for any space).
 *
 * A selected event's space is stamped by `useTrigger(space)` (on injected
 * events) and by `useAddThread(space)` (on thread-requested events).
 */
describe('useAddHandler space scoping', () => {
  test('scoped handler fires for a same-space triggered event and skips other spaces', () => {
    const received: string[] = []
    const { useTrigger, useAddHandler } = behavioral()
    const triggerA = useTrigger('spaceA')

    useAddHandler('spaceA')('event', () => {
      received.push('spaceA')
    })
    useAddHandler('spaceB')('event', () => {
      received.push('spaceB')
    })
    // Unscoped handler still fires (back-compat type-only match).
    useAddHandler()('event', () => {
      received.push('unscoped')
    })

    triggerA({ type: 'event' })

    expect(received).toEqual(['spaceA', 'unscoped'])
  })

  test('scoped handler ignores triggered events that carry no space', () => {
    const received: string[] = []
    const { useTrigger, useAddHandler } = behavioral()
    const trigger = useTrigger()

    useAddHandler('spaceA')('event', () => {
      received.push('spaceA')
    })
    useAddHandler()('event', () => {
      received.push('unscoped')
    })

    trigger({ type: 'event' })

    expect(received).toEqual(['unscoped'])
  })

  test('space propagates from useAddThread to a requested event and gates scoped handlers', () => {
    const received: string[] = []
    const { useAddThread, useTrigger, useAddHandler } = behavioral()
    const addThread = useAddThread('spaceA')
    const trigger = useTrigger()

    // Producer under spaceA requests 'event' — the selected event carries spaceA.
    addThread({ label: 'producer', rules: [{ request: { type: 'event' } }], once: true })

    useAddHandler('spaceA')('event', () => {
      received.push('spaceA')
    })
    useAddHandler('spaceB')('event', () => {
      received.push('spaceB')
    })
    useAddHandler()('event', () => {
      received.push('unscoped')
    })

    // Catalyst kick: 'go' is ingress (priority 0), selected first and unhandled;
    // the next super-step selects the producer's spaceA 'event' request.
    trigger({ type: 'go' })

    expect(received).toEqual(['spaceA', 'unscoped'])
  })
})
