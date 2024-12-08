import type { StoryObj } from 'plaited/test'
import { useIndexedDB } from '../use-indexed-db.js'
import sinon from 'sinon'

export const basic: StoryObj = {
  play: async ({ assert }) => {
    const db = await useIndexedDB<number>('basic')
    let actual = await db.get()
    assert({
      given: 'get',
      should: 'return undefined',
      actual: undefined,
      expected: undefined,
    })
    await db.set(0)
    actual = await db.get()
    assert({
      given: 'get',
      should: 'return undefined',
      actual,
      expected: 0,
    })
    await db.set(4)
    actual = await db.get()
    assert({
      given: 'set with 4',
      should: 'return 4',
      actual,
      expected: 4,
    })
    await db.set((await db.get()) + 1)
    actual = await db.get()
    assert({
      given: 'callback with previous value',
      should: 'return 5',
      actual,
      expected: 5,
    })
  },
}

export const withSubscription: StoryObj = {
  play: async ({ assert, wait }) => {
    const db = await useIndexedDB('subscription')
    await db.set(1)
    const actual = await db.get()
    assert({
      given: 'get',
      should: 'return initial value',
      actual,
      expected: 1,
    })
    const spy = sinon.spy()
    const disconnect = db.listen('a', spy)
    await db.set(3)
    await wait(60)
    assert({
      given: 'subscription to store',
      should: 'trigger callback with last value',
      actual: spy.args,
      expected: [[{ type: 'a', detail: 3 }]],
    })
    disconnect()
    await db.set(5)
    await wait(60)
    assert({
      given: 'disconnecting subscription',
      should: 'not trigger callback',
      actual: spy.callCount,
      expected: 1,
    })
  },
}
