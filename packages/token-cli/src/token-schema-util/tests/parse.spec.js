import test from 'ava'
import { parse }  from '../parse.js'
import { tokens } from '../../__mocks__/tokens.js'

let actual
test.before( () => {
  actual = parse({ json: tokens })
})



test('parse(): snapshot', t => {
  t.snapshot(actual)
})
// test('parse(): verify required props', t => {
 
//   const expected = Object.keys(tokens.platformSpaces)
//   t.deepEqual(actual.properties.platformSpaces.required, expected)
// })
// test('parse(): verify const props', t => {
//   const expected = tokens.s.$value
//   t.deepEqual(actual.properties.s.properties.$value.const, expected)
// })
// test('parse(): handles arrays', t => {
//   const expected = tokens.Small.$value[0].blur
//   t.deepEqual(actual.properties.Small.properties.$value.items[0].properties.blur.const, expected)
// })

