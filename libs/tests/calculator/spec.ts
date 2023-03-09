import { Assertion } from '$assert'
import { useIndexedDB } from '$plaited'

export const useIndexedDBTest = async (assert: Assertion) => {
  const [get, set] = await useIndexedDB<number>('testKey', 0)
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
  const [get2] = await useIndexedDB('testKey', 1)
  actual = await get2()
  assert({
    given: 'another useIndexedDB with same key but different initial value',
    should: 'return new initial value',
    actual,
    expected: 1,
  })
}
