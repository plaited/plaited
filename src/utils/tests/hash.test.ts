import test from 'ava'
import { hashString } from '../mod.ts'

test('hashString()', t => {
  t.is(hashString('test'), 2090756197, 'Given a string, return a hash')
  t.is(hashString(''), null, 'Given a damn empty string, return null')
})
