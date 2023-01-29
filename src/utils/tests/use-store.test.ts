import test from 'ava'
import { useStore } from '../index.ts'

test('useStore()', t => {
  const [ store, setStore ] = useStore<Record<string, number> | number>({ a: 1 })
  setStore(prev => {
    if(typeof prev !== 'number') return { ...prev, b: 2 }
    return prev
  })
  t.deepEqual(store(), { a: 1, b: 2 })
  setStore(3)
  t.is(store(), 3)
})
