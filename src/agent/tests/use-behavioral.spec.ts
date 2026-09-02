import { describe, expect, test } from 'bun:test'
import { behavioral } from '../../main/behavioral.ts'
import type { AddHandler, AddThread, Trigger, UseTrace } from '../../main/behavioral.types.ts'
import { type UseBehavioralCallback, useBehavioral } from '../use-behavioral.ts'

/**
 * `useBehavioral` is the consumer-side interface for pack-provided behaviors.
 * Its only job is to guarantee the export's shape and fix the param shape so the
 * harness invokes it with pre-scoped hooks. The wrapper is identity; the closure
 * and cross-handler `Disconnect` sharing live in the callback. Scoping (topic
 * currying) happens harness-side in the provisioning handler, not here.
 */
describe('useBehavioral', () => {
  test('returns the callback as-is (identity wrapper)', () => {
    const cb: UseBehavioralCallback = () => {}
    const wrapped = useBehavioral(cb)
    // Identity: the harness invokes what useBehavioral returns with scoped hooks.
    expect(wrapped).toBe(cb)
  })

  test('invoking the returned behavior with scoped hooks runs the callback', async () => {
    const bp = behavioral()
    const addThread = bp.useAddThread() as AddThread
    const addHandler = bp.useAddHandler() as AddHandler
    const trigger = bp.useTrigger() as Trigger
    const useTrace = bp.useTrace as UseTrace

    let called = false
    const behavior = useBehavioral(({ addThread: at, addHandler: ah, trigger: t, useTrace: ut }) => {
      expect(at).toBe(addThread)
      expect(ah).toBe(addHandler)
      expect(t).toBe(trigger)
      expect(ut).toBe(useTrace)
      // A behavior can register both a thread and a handler in one closure scope.
      at({ label: 'test-thread', rules: [{ request: { type: 'ping' } }], once: true })
      ah('ping', () => {})
      called = true
    })

    await behavior({ addThread, addHandler, trigger, useTrace })
    expect(called).toBe(true)
  })

  test('a sync behavior (no async) resolves without a promise', () => {
    const behavior = useBehavioral(() => {})
    // A pure thread-only behavior has no async work — useBehavioral must not force it.
    const result = behavior({
      addThread: (() => {}) as unknown as AddThread,
      addHandler: (() => {}) as unknown as AddHandler,
      trigger: (() => {}) as unknown as Trigger,
      useTrace: (() => {}) as unknown as UseTrace,
    })
    expect(result).toBeUndefined()
  })

  test('co-scoped handlers can share a Disconnect across the closure', async () => {
    const bp = behavioral()
    const addThread = bp.useAddThread() as AddThread
    const addHandler = bp.useAddHandler() as AddHandler
    const trigger = bp.useTrigger() as Trigger
    const useTrace = bp.useTrace as UseTrace

    const selected: string[] = []
    bp.useTrace((msg) => {
      if (msg.kind === 'selection') selected.push(msg.selected.type)
    })

    const fired: string[] = []
    const behavior = useBehavioral(({ addHandler: ah }) => {
      // The 'log' handler's Disconnect is captured in the shared closure scope.
      const stopLog = ah('log', () => {
        fired.push('log')
      })
      // A sibling handler in the same scope removes it via the caller-held Disconnect.
      ah('stop', () => {
        stopLog()
      })
    })

    await behavior({ addThread, addHandler, trigger, useTrace })

    // 'log' fires while its handler is active.
    trigger({ type: 'log' })
    expect(fired).toEqual(['log'])

    // 'stop' fires its handler, which calls stopLog — removing the 'log' handler.
    trigger({ type: 'stop' })
    expect(selected).toContain('stop')

    // 'log' again — handler was removed by the sibling, so it must not fire.
    trigger({ type: 'log' })
    expect(fired).toEqual(['log'])
  })
})
