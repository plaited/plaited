import { assert } from '@esm-bundle/chai'
import { trueTypeOf } from '..'

it('trueTypeOf()', () => {
  assert.equal(trueTypeOf([]), 'array')
  assert.equal(trueTypeOf({}), 'object')
  assert.equal(trueTypeOf(''), 'string')
  assert.equal(trueTypeOf(new Date()), 'date')
  assert.equal(trueTypeOf(1), 'number')
  /* eslint-disable */
  assert.equal(trueTypeOf(function () { }), 'function');
  /* eslint-enable */
  assert.equal(trueTypeOf(/test/i), 'regexp')
  assert.equal(trueTypeOf(RegExp('foo*')), 'regexp')
  assert.equal(trueTypeOf(true), 'boolean')
  assert.equal(trueTypeOf(null), 'null')
  assert.equal(trueTypeOf(), 'undefined')
  assert.equal(trueTypeOf(new Set()), 'set')
  assert.equal(trueTypeOf(new Map()), 'map')
  assert.equal(trueTypeOf(Symbol('Thing')), 'symbol')
})
