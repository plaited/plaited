import { test, expect } from 'bun:test'
import { keyMirror } from '../key-mirror.js'

test('keyMirror(): return an object of mirrored keys as values', () => {
  expect(keyMirror('a', 'b', 'c')).toEqual({
    a: 'a',
    b: 'b',
    c: 'c',
  })
})
