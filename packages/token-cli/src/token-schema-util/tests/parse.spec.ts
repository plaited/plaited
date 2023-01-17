// @ts-nocheck
import test from 'ava'
import { parse }  from '../parse.js'
import { importJson } from '../../import-json.js'
import { Schema, JSON, DesignTokenGroup } from '../../types.js'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

let actual: Schema
let json: DesignTokenGroup
test.before(async () => {
  json = await importJson(path.resolve(__dirname, './__mocks__/tokens.json'))
  actual = parse({ json: json as JSON })
})


test('parse(): snapshot', t => {
  t.snapshot(actual)
})
test('parse(): verify required props', t => {
 
  const expected = Object.keys(json.platformSpaces)
  t.deepEqual(actual.properties.platformSpaces.required, expected)
})
test('parse(): verify const props', t => {
  const expected = json.s.$value
  t.deepEqual(actual.properties.s.properties.$value.const, expected)
})
test('parse(): handles arrays', t => {
  const expected = json.Small.$value[0].blur
  t.deepEqual(actual.properties.Small.properties.$value.items[0].properties.blur.const, expected)
})

