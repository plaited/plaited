import { describe, expect, test } from 'bun:test'
import { z } from 'zod'
import type { Disconnect, Trigger } from '../../behavioral/behavioral.types.ts'
import { useComputed } from '../use-computed.ts'
import { useSignal } from '../use-signal.ts'

const noopTrigger: Trigger = () => {}

describe('useSignal', () => {
  test('stores values and notifies string listeners through the trigger', () => {
    const disconnectSet = new Set<Disconnect>()
    const seen: unknown[] = []
    const trigger: Trigger = ({ type, detail }) => {
      seen.push({ type, detail })
    }

    const signal = useSignal({
      key: 'count',
      schema: z.number(),
      disconnectSet,
      trigger,
    })

    signal.listen('count_updated')
    signal.set?.(3)

    expect(signal.get()).toBe(3)
    expect(seen).toEqual([{ type: 'count_updated', detail: 3 }])
  })

  test('does not update the store when schema validation fails', () => {
    const disconnectSet = new Set<Disconnect>()
    const violations: unknown[] = []

    const signal = useSignal({
      key: 'count',
      schema: z.number(),
      value: 1,
      disconnectSet,
      trigger: noopTrigger,
      onSchemaViolation: (detail) => {
        violations.push(detail)
      },
    })

    signal.set?.('nope' as never)

    expect(signal.get()).toBe(1)
    expect(violations).toHaveLength(1)
  })
})

describe('useComputed', () => {
  test('caches falsy computed values', () => {
    const disconnectSet = new Set<Disconnect>()
    let computeCount = 0

    const computed = useComputed(disconnectSet, noopTrigger)(() => {
      computeCount++
      return 0
    }, [])

    expect(computed.get()).toBe(0)
    expect(computed.get()).toBe(0)
    expect(computeCount).toBe(1)
  })

  test('recomputes when a dependency signal updates', () => {
    const disconnectSet = new Set<Disconnect>()
    const dep = useSignal({
      key: 'dep',
      schema: z.number(),
      value: 1,
      disconnectSet,
      trigger: noopTrigger,
    })
    const computed = useComputed(disconnectSet, noopTrigger)(() => (dep.get() ?? 0) * 2, [dep])

    let notifications = 0
    computed.listen(() => {
      notifications++
    })

    dep.set?.(3)

    expect(computed.get()).toBe(6)
    expect(notifications).toBe(1)
  })

  test('does not accumulate dependency subscriptions after re-subscribing', () => {
    const disconnectSet = new Set<Disconnect>()
    const dep = useSignal({
      key: 'dep',
      schema: z.number(),
      value: 1,
      disconnectSet,
      trigger: noopTrigger,
    })
    const computed = useComputed(disconnectSet, noopTrigger)(() => dep.get() ?? 0, [dep])

    let notifications = 0

    const firstDisconnect = computed.listen(() => {
      notifications++
    })
    dep.set?.(2)
    firstDisconnect()

    const secondDisconnect = computed.listen(() => {
      notifications++
    })
    dep.set?.(3)
    secondDisconnect()

    expect(notifications).toBe(2)
  })
})
