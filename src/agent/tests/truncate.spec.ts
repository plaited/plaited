import { describe, expect, test } from 'bun:test'
import { truncateHead, truncateTail } from '../truncate.ts'

describe('truncateHead', () => {
  test('returns full content when within limits', () => {
    const result = truncateHead('line1\nline2\nline3')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('line1\nline2\nline3')
    expect(result.totalLines).toBe(3)
    expect(result.outputLines).toBe(3)
  })

  test('truncates to maxLines', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line${i}`).join('\n')
    const result = truncateHead(lines, { maxLines: 3 })
    expect(result.truncated).toBe(true)
    expect(result.content).toBe('line0\nline1\nline2\n')
    expect(result.totalLines).toBe(10)
    expect(result.outputLines).toBe(4)
  })

  test('truncates to maxBytes', () => {
    const lines = 'abcde\nfghij\nklmno'
    const result = truncateHead(lines, { maxBytes: 10 })
    expect(result.truncated).toBe(true)
    expect(result.totalBytes).toBe(17)
    expect(Buffer.byteLength(result.content)).toBeLessThanOrEqual(10)
  })

  test('handles empty string', () => {
    const result = truncateHead('')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('')
    expect(result.totalLines).toBe(1)
    expect(result.outputLines).toBe(1)
  })
})

describe('truncateTail', () => {
  test('returns full content when within limits', () => {
    const result = truncateTail('line1\nline2\nline3')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('line1\nline2\nline3')
    expect(result.totalLines).toBe(3)
    expect(result.outputLines).toBe(3)
  })

  test('keeps last N lines when truncating by maxLines', () => {
    const lines = Array.from({ length: 10 }, (_, i) => `line${i}`).join('\n')
    const result = truncateTail(lines, { maxLines: 3 })
    expect(result.truncated).toBe(true)
    expect(result.content).toBe('line7\nline8\nline9')
    expect(result.totalLines).toBe(10)
    expect(result.outputLines).toBe(3)
  })

  test('truncates to maxBytes from end', () => {
    const lines = 'abcde\nfghij\nklmno'
    const result = truncateTail(lines, { maxBytes: 10 })
    expect(result.truncated).toBe(true)
    expect(Buffer.byteLength(result.content)).toBeLessThanOrEqual(10)
    expect(result.content).toContain('klmno')
  })

  test('handles empty string', () => {
    const result = truncateTail('')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('')
    expect(result.totalLines).toBe(1)
  })
})
