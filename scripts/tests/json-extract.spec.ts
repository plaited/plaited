import { describe, expect, test } from 'bun:test'
import { extractFirstJsonObject, extractTaggedJsonObject } from '../json-extract.ts'

describe('json extract', () => {
  test('extracts a bare json object', () => {
    expect(extractFirstJsonObject('{"a":1}')).toBe('{"a":1}')
  })

  test('extracts json object surrounded by prose', () => {
    expect(extractFirstJsonObject('Here is the result:\n{"a":1,"b":"x"}\nThanks')).toBe('{"a":1,"b":"x"}')
  })

  test('handles braces inside strings', () => {
    expect(extractFirstJsonObject('prefix {"a":"value with } brace","b":{"c":2}} suffix')).toBe(
      '{"a":"value with } brace","b":{"c":2}}',
    )
  })

  test('returns null when no full object exists', () => {
    expect(extractFirstJsonObject('{"a":1')).toBeNull()
    expect(extractFirstJsonObject('no json here')).toBeNull()
  })

  test('extracts a tagged json object', () => {
    expect(
      extractTaggedJsonObject({
        text: 'prefix <json>{"a":1,"b":"x"}</json> suffix',
        tag: 'json',
      }),
    ).toBe('{"a":1,"b":"x"}')
  })

  test('returns null when tagged json is missing', () => {
    expect(
      extractTaggedJsonObject({
        text: 'prefix <json>{"a":1}',
        tag: 'json',
      }),
    ).toBeNull()
  })
})
