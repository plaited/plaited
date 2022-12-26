import test from 'ava'
import { parseToRgb } from '../index.js'

test('parseToRgb: improper hex', t => {
  t.is(parseToRgb('8A99A8'), undefined)
})
test('parseToRgb: six digits', t => {
  t.is(parseToRgb('#8A99A8'), 'rgb(138,153,168)')
})
test('parseToRgb: eight digits', t => {
  t.is(parseToRgb('#8A99A80A'), 'rgba(138,153,168,0.04)')
})
