import type { StoryObj } from '../../assert/assert.types.js'
import { createIDB } from '../create-idb.js'

export const example: StoryObj = {
  play: async ({ assert }) => {
    const db = createIDB<number>('test-store')
    await db.set('basic', 4)
    let actual = await db.get('basic')
    assert({
      given: 'set with 4',
      should: 'return 4',
      actual,
      expected: 4,
    })
    await db.set('basic', (await db.get('basic')) + 1)
    actual = await db.get('basic')
    assert({
      given: 'callback with previous value',
      should: 'return 5',
      actual,
      expected: 5,
    })

    await db.set('basic', 7)
    actual = await db.get('basic')
    assert({
      given: 'actual from set',
      should: 'return 7',
      actual,
      expected: 7,
    })
    actual = await db.get('basic')
    assert({
      given: 'get called right after',
      should: 'return 7',
      actual,
      expected: 7,
    })
    await db.delete('basic')
    actual = await db.get('basic')
    assert({
      given: 'get called after delete',
      should: 'return undefined',
      actual,
      expected: undefined,
    })
  },
}
