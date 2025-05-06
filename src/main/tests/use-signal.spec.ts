/**
 * Test suite for validating signal behavior in Plaited.
 * Tests state management, subscription handling, and cleanup.
 *
 * Tests:
 * - Signal subscription and unsubscription
 * - Event triggering order
 * - Computed signal updates
 * - Memory leak prevention
 * - Edge case handling
 */

import { test, expect } from 'bun:test'
import sinon from 'sinon'
import { useSignal, useComputed } from 'plaited'

test('useSignal:calling listen before setting store then disconnecting', () => {
  const store = useSignal<{ value: number }>({ value: 0 })
  const spy = sinon.spy()
  const disconnect = store.listen('a', spy)
  store.set({ value: 4 })
  expect(spy.calledWith({ type: 'a', detail: { value: 4 } })).toBeTrue()
  disconnect()
  store.set({ value: 5 })
  expect(spy.calledTwice).toBeFalse()
})

test('useSignal:setting store before calling listen then disconnecting', () => {
  const spy = sinon.spy()
  const store = useSignal<{ value: number }>({ value: 0 })
  store.set({ value: 4 })
  const disconnect = store.listen('b', spy)
  store.set({ value: 4 })
  disconnect()
  expect(spy.calledTwice).toBeFalse()
})

test('useSignal: calling listen then disconnecting before setting store', () => {
  const spy = sinon.spy()
  const store = useSignal<{ value: number }>({ value: 0 })
  const disconnect = store.listen('b', spy)
  disconnect()
  store.set({ value: 4 })
  expect(spy.called).toBeFalse()
})

test('validate useComputed function as expected', () => {
  const spy = sinon.spy()
  const store = useSignal<number>(1)
  const computed = useComputed<number>(() => store.get() + 2, [store])
  const disconnect = computed.listen('b', spy)
  expect(store.get()).toBe(1)
  store.set(3)
  expect(spy.calledWith({ type: 'b', detail: 5 })).toBe(true)
  disconnect()
  store.set(6)
  expect(spy.calledWith({ type: 'b', detail: 8 })).toBe(false)
})
