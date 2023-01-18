import test from 'ava'
import { parse , Schema }  from '../parse.js'
import { tokens } from '../../__mocks__/tokens.js'

let actual: Schema
test.before( () => {
  actual = parse({ tokens })
})



test('parse(): snapshot', t => {
  t.snapshot(actual)
})
test('parse(): verify required props', t => {
  //@ts-ignore: it exist
  const expected = Object.keys(tokens.size.x1.$value)
  t.deepEqual(actual?.properties?.size?.properties?.x1?.properties?.$value?.required, expected)
})
test('parse(): verify const props', t => {
  //@ts-ignore: it exist
  const expected = tokens.backgroundColor.purple.x1.$value
  t.deepEqual(
    actual?.
      properties?.
      backgroundColor?.
      properties?.
      purple?.
      properties?.
      x1?.
      properties?.
      $value?.
      const, 
    expected
  )
})
test('parse(): handles arrays', t => {
  //@ts-ignore: it exist
  const expected = tokens.fontFamily.sansSerif.$value.map((str:string) => ({ const: str, type: 'string' }))
  t.deepEqual(actual?.properties?.fontFamily?.properties?.sansSerif?.properties?.$value?.items, expected)
})

