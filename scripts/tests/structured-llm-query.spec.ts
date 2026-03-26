import { describe, expect, test } from 'bun:test'
import { extractStructuredJsonObject } from '../structured-llm-query.ts'

describe('structured llm query json extraction', () => {
  test('extracts fenced json', () => {
    expect(extractStructuredJsonObject('```json\n{"a":1}\n```')).toBe('{"a":1}')
  })

  test('extracts tagged json', () => {
    expect(extractStructuredJsonObject('prefix <json>{"a":1}</json> suffix')).toBe('{"a":1}')
  })

  test('extracts first balanced json object', () => {
    expect(extractStructuredJsonObject('prefix {"a":{"b":2}} suffix')).toBe('{"a":{"b":2}}')
  })
})
