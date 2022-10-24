import { assert } from '@esm-bundle/chai'
import { ueid, generateId, setIdCounter } from '..'

describe('id', () => {
  it('ueid: returns a string', () => {
    const output = ueid()
    assert.isString(typeof output)
  })

  it('ueid: should return unique ids', function () {
    const ids = new Array(5).fill(null).map(ueid)
    const uniqued = [ ...new Set(ids) ]

    assert.lengthOf(ids, 5)
    assert.lengthOf(uniqued, 5)
  })

  it('ueid: supports an optional prefix', function () {
    assert.include(ueid('a-'), 'a-')
    assert.include(ueid('b-'), 'b-')
    assert.include(ueid('c:'), 'c:')
    assert.include(ueid('word_'), 'word_')
  })

  it('generateId: should return string with iterated count', () => {
    assert.equal(generateId(), '0')
    assert.equal(generateId(), '1')
  })

  it('generateId: should return prefixed string with iterated count', () => {
    assert.equal(generateId('pre-'), 'pre-2')
    assert.equal(generateId('pre-'), 'pre-3')
  })
  it('generateId: should return reset prefixed string with iterated count', () => {
    setIdCounter(0)
    assert.equal(generateId('pre-'), 'pre-0')
    assert.equal(generateId('pre-'), 'pre-1')
  })
})
