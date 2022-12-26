import test from 'ava'
import { useStore } from '..'

test('useStore()', t => {
  const [ store, setStore ] = useStore<unknown>({ a: 1 })
  setStore(prev => ({ ...prev, b: 2 }))
  t.deepEqual(store(), { a: 1, b: 2 })
  setStore(prev => {
    // eslint-disable-next-line no-unused-vars
    prev = 2
  })
  t.is(store(), undefined)
  setStore(3)
  t.is(store(), 3)
})

test('useStore(): strict', t => {
  const [ getMode, setMode ] = useStore<'ready' | 'running' | 'paused'>('ready')
  setMode('running')
  t.is(getMode(), 'running')
})
