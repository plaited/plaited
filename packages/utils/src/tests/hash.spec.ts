import { assert } from '@esm-bundle/chai'
import { hashString } from '..'

it('hashString()', () => {
  assert.equal(hashString('test'), 2090756197, 'Given a string, return a hash')
  assert.isNull(hashString(''), 'Given a damn empty string, return null')
})
