import { test, expect } from 'bun:test'
import { parse } from '../parse.js'
import { tokens } from './sample-tokens.js'

const actual = parse({ tokens })

test('parse(): snapshot', () => {
  expect(actual).toMatchSnapshot()
})
test('parse(): verify required props', () => {
  //@ts-ignore: it exist
  const expected = Object.keys(tokens.size.x1.$value)
  expect(actual?.properties?.size?.properties?.x1?.properties?.$value?.required).toEqual(expected)
})
test('parse(): verify const props', () => {
  //@ts-ignore: it exist
  const expected = tokens.backgroundColor.purple.x1.$value
  // eslint-disable-next-line no-unsafe-optional-chaining
  const value = actual?.properties?.backgroundColor?.properties?.purple?.properties?.x1.properties?.$value?.properties
  expect({ l: value?.l?.const, c: value?.c?.const, h: value?.h?.const }).toEqual(expected)
})
test('parse(): handles arrays', () => {
  //@ts-ignore: it exist
  const expected = tokens.fontFamily.sansSerif.$value.map((str: string) => ({
    const: str,
    type: 'string',
  }))
  expect(actual?.properties?.fontFamily?.properties?.sansSerif?.properties?.$value?.items).toEqual(expected)
})
