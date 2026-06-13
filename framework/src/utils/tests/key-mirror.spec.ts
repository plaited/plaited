import { expect, test } from 'bun:test'
import { keyMirror } from 'onbraid/utils'

test('keyMirror(): return an object of mirrored keys as values', () => {
  expect(keyMirror('a', 'b', 'c')).toEqual({
    a: 'a',
    b: 'b',
    c: 'c',
  })
})
