import { test } from '@plaited/rite'
import { useIndexedDB } from '../../src/utils.js'
import sinon from 'sinon'

test('useIndexedDB', async (t) => {
  const [get, set] = await useIndexedDB<number>('basic', 0)
  let actual = await get()
  t({
    given: 'get',
    should: 'return 0',
    actual,
    expected: 0,
  })
  await set(4)
  actual = await get()
  t({
    given: 'set with 4',
    should: 'return 4',
    actual,
    expected: 4,
  })
  await set((x) => x + 1)
  actual = await get()
  t({
    given: 'callback with previous value',
    should: 'return 5',
    actual,
    expected: 5,
  })

  actual = await set(7)
  t({
    given: 'actual from set',
    should: 'return 7',
    actual,
    expected: 7,
  })
  actual = await get()
  t({
    given: 'get called right after',
    should: 'return 7',
    actual,
    expected: 7,
  })
})

test('useIndexedDB: with subscription', async (t) => {
  const [get, set] = await useIndexedDB('subscription', 1)
  const actual = await get()
  t({
    given: 'another useIndexedDB with same key but different initial value',
    should: 'return new initial value',
    actual,
    expected: 1,
  })
  const spy = sinon.spy()
  const disconnect = get.subscribe(spy)
  await set(3)
  await t.wait(60)
  t({
    given: 'subscription to store',
    should: 'trigger callback with last value',
    actual: spy.args,
    expected: [[3]],
  })
  disconnect()
  await set(5)
  await t.wait(60)
  t({
    given: 'disconnecting subscription',
    should: 'callback should not be triggered',
    actual: spy.callCount,
    expected: 1,
  })
})
