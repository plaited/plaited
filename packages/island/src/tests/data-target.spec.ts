import { assert } from '@esm-bundle/chai'
import { dataTarget } from '..'

it('dataTarget()', () => {
  assert.equal(dataTarget('random'), 'data-target="random"')
})
