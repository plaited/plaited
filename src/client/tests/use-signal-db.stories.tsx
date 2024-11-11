import type { StoryObj } from '../../assert/assert.types.js'
import { useSignalDB, useComputedDB } from '../use-signal-db.js'
import sinon from 'sinon'

export const basic: StoryObj = {
  play: async ({ assert }) => {
    const pub = await useSignalDB<number>('basic', 0)
    let actual = await pub.get()
    assert({
      given: 'get',
      should: 'return 0',
      actual,
      expected: 0,
    })
    await pub(4)
    actual = await pub.get()
    assert({
      given: 'set with 4',
      should: 'return 4',
      actual,
      expected: 4,
    })
    await pub((await pub.get()) + 1)
    actual = await pub.get()
    assert({
      given: 'callback with previous value',
      should: 'return 5',
      actual,
      expected: 5,
    })

    await pub(7)
    actual = await pub.get()
    assert({
      given: 'actual from set',
      should: 'return 7',
      actual,
      expected: 7,
    })
    actual = await pub.get()
    assert({
      given: 'get called right after',
      should: 'return 7',
      actual,
      expected: 7,
    })
  },
}

export const withSubscription: StoryObj = {
  play: async ({ assert, wait }) => {
    const pub = await useSignalDB('subscription', 1)
    const actual = await pub.get()
    assert({
      given: 'get',
      should: 'return initial value',
      actual,
      expected: 1,
    })
    const spy = sinon.spy()
    const disconnect = pub.effect('a', spy)
    await pub(3)
    await wait(60)
    assert({
      given: 'subscription to store',
      should: 'trigger callback with last value',
      actual: spy.args,
      expected: [[{ type: 'a', detail: 3 }]],
    })
    disconnect()
    await pub(5)
    await wait(60)
    assert({
      given: 'disconnecting subscription',
      should: 'not trigger callback',
      actual: spy.callCount,
      expected: 1,
    })
  },
}

export const useComputed: StoryObj = {
  play: async ({ assert, wait }) => {
    const store = await useSignalDB('computed', 1)
    const actual = await store.get()
    assert({
      given: 'get',
      should: 'return initial value',
      actual,
      expected: 1,
    })
    const spy = sinon.spy()
    const computed = await useComputedDB<number>(async () => (await store.get()) + 2, [store])
    const disconnect = await computed.effect('a', spy)
    await store(3)
    await wait(60)
    assert({
      given: 'subscription to store',
      should: 'trigger callback with last value',
      actual: spy.args,
      expected: [[{ type: 'a', detail: 5 }]],
    })
    disconnect()
    await store(5)
    await wait(60)
    assert({
      given: 'disconnecting subscription',
      should: 'not trigger callback',
      actual: spy.callCount,
      expected: 1,
    })
  },
}
