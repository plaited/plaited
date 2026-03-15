import { describe, expect, test } from 'bun:test'
import { truncateHead, truncateTail } from '../truncate.ts'

// ============================================================================
// truncateHead
// ============================================================================

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
    expect(result.outputLines).toBe(4) // 3 lines + empty after trailing \n
  })

  test('truncates to maxBytes', () => {
    const lines = 'abcde\nfghij\nklmno'
    const result = truncateHead(lines, { maxBytes: 10 })
    expect(result.truncated).toBe(true)
    expect(result.totalBytes).toBe(17)
    expect(Buffer.byteLength(result.content)).toBeLessThanOrEqual(10)
  })

  test('applies tighter of maxLines and maxBytes', () => {
    // 5 lines of 10 chars each = 50+ bytes
    const lines = Array.from({ length: 5 }, (_, i) => `line_____${i}`).join('\n')
    const result = truncateHead(lines, { maxLines: 100, maxBytes: 20 })
    expect(result.truncated).toBe(true)
    expect(Buffer.byteLength(result.content)).toBeLessThanOrEqual(20)
  })

  test('handles empty string', () => {
    const result = truncateHead('')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('')
    expect(result.totalLines).toBe(1)
    expect(result.outputLines).toBe(1)
  })

  test('handles single line without newline', () => {
    const result = truncateHead('hello')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('hello')
    expect(result.totalLines).toBe(1)
  })

  test('uses default limits (2000 lines / 50KB)', () => {
    // Under both limits: should not truncate
    const lines = Array.from({ length: 100 }, (_, i) => `line${i}`).join('\n')
    const result = truncateHead(lines)
    expect(result.truncated).toBe(false)
  })
})

// ============================================================================
// truncateTail
// ============================================================================

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
    // Should contain the tail portion
    expect(result.content).toContain('klmno')
  })

  test('handles empty string', () => {
    const result = truncateTail('')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('')
    expect(result.totalLines).toBe(1)
  })

  test('handles single line without newline', () => {
    const result = truncateTail('hello')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('hello')
    expect(result.totalLines).toBe(1)
  })

  test('uses default limits (2000 lines / 50KB)', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line${i}`).join('\n')
    const result = truncateTail(lines)
    expect(result.truncated).toBe(false)
  })
})
