import test from 'ava'
import { parse }  from './parse.js'
import json  from './__mocks__/set.json'



const actual = parse({ json })
test('parse(): snapshot', t => {
  t.snapshot(actual)
})
test('parse(): verify required props', t => {
  const expected = Object.keys(json.platformSpaces)
  t.deepEqual(actual.properties.platformSpaces.required, expected)
})
test('parse(): verify const props', t => {
  const expected = json.s.value
  t.deepEqual(actual.properties.s.properties.value.const, expected)
})
test('parse(): handles arrays', t => {
  const expected = json.Small.value[0].blur
  t.deepEqual(actual.properties.Small.properties.value.items[0].properties.blur.const, expected)
})

