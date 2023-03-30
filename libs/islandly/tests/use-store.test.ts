import { assertEquals } from '../../dev-deps.ts'
import { useStore } from '../mod.ts'

Deno.test('useStore()', () => {
  const [store, setStore] = useStore<Record<string, number> | number>({ a: 1 })
  setStore((prev) => {
    if (typeof prev !== 'number') prev.b = 2
    return prev
  })
  assertEquals(store(), { a: 1, b: 2 })
  setStore(3)
  assertEquals(store(), 3)
})
