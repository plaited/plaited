import { assert } from '@esm-bundle/chai'
import { useIndexedDB } from '..'

describe('useIndexedDB', () => {
  it('exercise useIndexedDB', async () => {
    const [ get, set ] = await useIndexedDB('testKey')
    await set((x = 1) => x + 1)
    let actual = await get()
    assert.equal(
      actual, 2,
      'Given callback with no initial value it should return 2'
    )
    actual = await get()
    assert.equal(
      actual, 2,
      'Given calling getit should return 2'
    )
    await set(4)
    actual = await get()
    assert.equal(
      actual, 4,
      'Given set with just a value it sould return 4'
    )
    await set(x => x + 1)
    actual = await get()
    assert.equal(
      actual, 5,
      'Given callback with previous value it should return 5'
    )
    const [ get2 ] = await useIndexedDB('testKey', 1)
    actual = await get2()
    assert.equal(
      actual, 1,
      'Given instantiating another useIndexedDB with same key but initial value'+
      'it should return initial value'
    )
  })
})
