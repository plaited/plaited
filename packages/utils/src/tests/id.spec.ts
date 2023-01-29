import test from 'ava'
import { ueid, generateId, setIdCounter } from '../index.js'

test('ueid: returns a string', t => {
  const output = ueid()
  t.is(typeof output, 'string')
})

test('ueid: should return unique ids', t => {
  const ids = new Array(5).fill(null).map(ueid)
  const uniqued = [ ...new Set(ids) ]

  t.is(ids.length, 5)
  t.is(uniqued.length, 5)
})

test('ueid: supports an optional prefix', t => {
  t.is(ueid('a-').startsWith('a-'), true)
  t.is(ueid('b-').startsWith('b-'), true)
  t.is(ueid('c:').startsWith('c:'), true)
  t.is(ueid('word_').startsWith('word_'), true)
})

test('generateId: should return string with iterated count', t => {
  t.is(generateId(), '0')
  t.is(generateId(), '1')
})

test('generateId: should return prefixed string with iterated count', t => {
  t.is(generateId('pre-'), 'pre-2')
  t.is(generateId('pre-'), 'pre-3')
})

test('generateId: should return reset prefixed string with iterated count', t => {
  setIdCounter(0)
  t.is(generateId('pre-'), 'pre-0')
  t.is(generateId('pre-'), 'pre-1')
})

