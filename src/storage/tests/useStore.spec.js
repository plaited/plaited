import {assert} from '@esm-bundle/chai'
import {useStore} from '..'

it('useStore()', () => {
  const [store, setStore] = useStore({a: 1})
  setStore(prev => ({...prev, b: 2}))
  assert.deepEqual(store(), {a: 1, b: 2})
  setStore(prev => {
    // eslint-disable-next-line no-unused-vars
    prev = 2
  })
  assert.equal(store(), undefined)
  setStore(3)
  assert.equal(store(), 3)
})
