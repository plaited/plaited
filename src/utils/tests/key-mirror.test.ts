import test from 'ava'
import { keyMirror } from '../mod.ts'

test('keyMirror()', t => {
  t.deepEqual(keyMirror('a', 'b', 'c'), {
    a: 'a',
    b: 'b',
    c: 'c',
  }, 'return a object of mirrored string values')
})