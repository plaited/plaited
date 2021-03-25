import {assert} from '@plaited/assert'
import {useIndexedDB} from '../useIndexedDB'

describe('useIndexedDB', function() {
  it('exercise useIndexedDB', async function() {
    const [get, set] = await useIndexedDB('testKey')
    await set((x = 1) => x + 1)
    let actual = await get()
    assert({
      given: 'callback with no initial value',
      should: 'return 2',
      actual,
      expected: 2,
    })
    actual = await get()
    assert({
      given: 'calling get',
      should: 'return 2',
      actual,
      expected: 2,
    })
    await set(4)
    actual = await get()
    assert({
      given: 'set with just a value',
      should: 'return 4',
      actual,
      expected: 4,
    })
    await set(x => x + 1)
    actual = await get()
    assert({
      given: 'callback with previous value',
      should: 'return 5',
      actual,
      expected: 5,
    })
    const [get2] = await useIndexedDB('testKey', 1)
    actual = await get2()
    assert({
      given: 'instantiating another useIndexedDB with same key but initial value',
      should: 'return initial value',
      actual,
      expected: 1,
    })
  })
})
