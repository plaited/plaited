import { describe, expect, test } from 'bun:test'
import { DelegatedListener, delegates } from '../delegated-listener.ts'

describe('DelegatedListener', () => {
  test('handleEvent calls callback with the event', () => {
    const events: Event[] = []
    const listener = new DelegatedListener((ev: Event) => {
      events.push(ev)
    })
    const event = new Event('click')
    listener.handleEvent(event)
    expect(events).toHaveLength(1)
    expect(events[0]).toBe(event)
  })

  test('handleEvent handles async callback (void coalesced)', () => {
    const listener = new DelegatedListener(async (_ev: Event) => {
      await Promise.resolve()
    })
    // Should not throw — the async return is void-coalesced by handleEvent
    expect(() => listener.handleEvent(new Event('click'))).not.toThrow()
  })

  test('callback property is assignable and readable', () => {
    const cb1 = (_ev: Event) => {}
    const cb2 = (_ev: Event) => {}
    const listener = new DelegatedListener(cb1)
    expect(listener.callback).toBe(cb1)
    listener.callback = cb2
    expect(listener.callback).toBe(cb2)
  })
})

describe('delegates WeakMap', () => {
  test('stores and retrieves by EventTarget key', () => {
    const target = new EventTarget()
    const listener = new DelegatedListener(() => {})
    delegates.set(target, listener)
    expect(delegates.get(target)).toBe(listener)
  })

  test('returns undefined for unset targets', () => {
    const target = new EventTarget()
    expect(delegates.get(target)).toBeUndefined()
  })
})
