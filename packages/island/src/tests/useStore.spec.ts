import { assert } from '@esm-bundle/chai'
import { useStore } from '..'

it('useStore()', () => {
  const [ store, setStore ] = useStore<unknown>({ a: 1 })
  setStore(prev => ({ ...prev, b: 2 }))
  assert.deepEqual(store(), { a: 1, b: 2 })
  setStore(prev => {
    // eslint-disable-next-line no-unused-vars
    prev = 2
  })
  assert.equal(store(), undefined)
  setStore(3)
  assert.equal(store(), 3)
})

it('useStore(): strict', () => {
  const [ getMode, setMode ] = useStore<'ready' | 'running' | 'paused'>('ready')
  setMode('running')
  assert.equal(getMode(), 'running')
})
