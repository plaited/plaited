import { describe, expect, test } from 'bun:test'
import { behavioral } from '../behavioral.ts'

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
    addThread('producer', { rules: [{ request: { type: 'event' } }], once: true })

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
