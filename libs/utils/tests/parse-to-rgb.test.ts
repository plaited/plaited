import { assertEquals } from '../../test-deps.ts'
import { parseToRgb } from '../mod.ts'

Deno.test('parseToRgb: improper hex', () => {
  assertEquals(parseToRgb('8A99A8'), undefined)
})
Deno.test('parseToRgb: six digits', () => {
  assertEquals(parseToRgb('#8A99A8'), 'rgb(138,153,168)')
})
Deno.test('parseToRgb: eight digits', () => {
  assertEquals(parseToRgb('#8A99A80A'), 'rgba(138,153,168,0.04)')
})
