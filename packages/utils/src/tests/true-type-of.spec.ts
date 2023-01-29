import test from 'ava'
import { trueTypeOf } from '../index.js'

test('trueTypeOf()', t => {
  t.is(trueTypeOf([]), 'array')
  t.is(trueTypeOf({}), 'object')
  t.is(trueTypeOf(''), 'string')
  t.is(trueTypeOf(new Date()), 'date')
  t.is(trueTypeOf(1), 'number')
  /* eslint-disable */
  t.is(trueTypeOf(function () { }), 'function');
  /* eslint-enable */
  t.is(trueTypeOf(/test/i), 'regexp')
  t.is(trueTypeOf(RegExp('foo*')), 'regexp')
  t.is(trueTypeOf(true), 'boolean')
  t.is(trueTypeOf(null), 'null')
  t.is(trueTypeOf(), 'undefined')
  t.is(trueTypeOf(new Set()), 'set')
  t.is(trueTypeOf(new Map()), 'map')
  t.is(trueTypeOf(Symbol('Thing')), 'symbol')
})
