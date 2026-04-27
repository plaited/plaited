import { describe, expect, test } from 'bun:test'
import { limitTextBytes } from '../limit-text-bytes.ts'

const encoder = new TextEncoder()

describe('limitTextBytes', () => {
  test('returns original text unchanged when encoded byte length is below the limit', () => {
    const text = 'hello'
    const result = limitTextBytes(text, 10)

    expect(result).toEqual({
      text,
      truncated: false,
      originalBytes: encoder.encode(text).length,
    })
  })

  test('returns original text unchanged when encoded byte length equals the limit', () => {
    const text = 'hello'
    const maxBytes = encoder.encode(text).length
    const result = limitTextBytes(text, maxBytes)

    expect(result).toEqual({
      text,
      truncated: false,
      originalBytes: maxBytes,
    })
  })

  test('truncates ASCII text by byte count and sets truncated true', () => {
    const text = 'abcdefghij'
    const result = limitTextBytes(text, 4)

    expect(result.text).toBe('abcd')
    expect(result.truncated).toBe(true)
  })

  test('reports originalBytes as the full encoded byte length', () => {
    const text = 'abcdefghij'
    const result = limitTextBytes(text, 4)

    expect(result.originalBytes).toBe(encoder.encode(text).length)
  })

  test('truncates multibyte UTF-8 text by bytes instead of character count', () => {
    const text = 'ééé'
    const result = limitTextBytes(text, 4)

    expect(result.text).toBe('éé')
    expect(result.truncated).toBe(true)
    expect(result.originalBytes).toBe(encoder.encode(text).length)
  })

  test('returns the current TextDecoder output when truncating in the middle of a multibyte character', () => {
    const text = '🙂done'
    const maxBytes = 3
    const expected = new TextDecoder().decode(encoder.encode(text).slice(0, maxBytes))
    const result = limitTextBytes(text, maxBytes)

    expect(result.text).toBe(expected)
    expect(result.truncated).toBe(true)
    expect(result.originalBytes).toBe(encoder.encode(text).length)
  })

  test('supports maxBytes = 0', () => {
    const text = 'hello'
    const result = limitTextBytes(text, 0)

    expect(result.text).toBe('')
    expect(result.truncated).toBe(true)
    expect(result.originalBytes).toBe(encoder.encode(text).length)
  })
})
