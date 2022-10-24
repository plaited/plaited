import { assert } from '@esm-bundle/chai'
import { keyMirror } from '../'

describe('keyMirror()', () => {
  it('return a object of mirrored string values', () => {
    assert.deepEqual(keyMirror('a', 'b', 'c'), {
      a: 'a',
      b: 'b',
      c: 'c',
    })
  })
})
