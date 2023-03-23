import { parse } from '../parse.ts'
import { tokens } from './sample-tokens.ts'
import { assertEquals, assertSnapshot } from '../../dev-deps.ts'

const actual = parse({ tokens })

Deno.test('parse(): snapshot', (t) => {
  assertSnapshot(t, actual)
})
Deno.test('parse(): verify required props', () => {
  //@ts-ignore: it exist
  const expected = Object.keys(tokens.size.x1.$value)
  assertEquals(
    actual?.properties?.size?.properties?.x1?.properties?.$value?.required,
    expected,
  )
})
Deno.test('parse(): verify const props', () => {
  //@ts-ignore: it exist
  const expected = tokens.backgroundColor.purple.x1.$value
  assertEquals(
    actual
      ?.properties
      ?.backgroundColor
      ?.properties
      ?.purple
      ?.properties
      ?.x1
      ?.properties
      ?.$value
      ?.const,
    expected,
  )
})
Deno.test('parse(): handles arrays', () => {
  //@ts-ignore: it exist
  const expected = tokens.fontFamily.sansSerif.$value.map((str: string) => ({
    const: str,
    type: 'string',
  }))
  assertEquals(
    actual?.properties?.fontFamily?.properties?.sansSerif?.properties?.$value
      ?.items,
    expected,
  )
})
