import { assert, wait } from '@plaited/storybook-rite'
import { Meta, StoryObj } from '@plaited/storybook'
import { useIndexedDB } from '../use-indexed-db.js'
import sinon from 'sinon'

const meta: Meta = {
  title: 'Tests/useIndexedDB',
  component: () => <></>,
}

export default meta
type Story = StoryObj

export const basic: Story = {
  play: async () => {
    const [get, set] = await useIndexedDB<number>('basic', 0)
    let actual = await get()
    assert({
      given: 'get',
      should: 'return 0',
      actual,
      expected: 0,
    })
    await set(4)
    actual = await get()
    assert({
      given: 'set with 4',
      should: 'return 4',
      actual,
      expected: 4,
    })
    await set((x) => x + 1)
    actual = await get()
    assert({
      given: 'callback with previous value',
      should: 'return 5',
      actual,
      expected: 5,
    })

    actual = await set(7)
    assert({
      given: 'actual from set',
      should: 'return 7',
      actual,
      expected: 7,
    })
    actual = await get()
    assert({
      given: 'get called right after',
      should: 'return 7',
      actual,
      expected: 7,
    })
  },
}

export const withSubscription: Story = {
  play: async () => {
    const [get, set] = await useIndexedDB('subscription', 1)
    const actual = await get()
    assert({
      given: 'get',
      should: 'return initial value',
      actual,
      expected: 1,
    })
    const spy = sinon.spy()
    const disconnect = get.subscribe(spy)
    await set(3)
    await wait(60)
    assert({
      given: 'subscription to store',
      should: 'trigger callback with last value',
      actual: spy.args,
      expected: [[3]],
    })
    disconnect()
    await set(5)
    await wait(60)
    assert({
      given: 'disconnecting subscription',
      should: 'not trigger callback',
      actual: spy.callCount,
      expected: 1,
    })
  },
}
