import { describe, expect, test } from 'bun:test'
import {
  DEFAULT_MAX_BYTES,
  formatSize,
  GREP_MAX_LINE_LENGTH,
  truncateHead,
  truncateLine,
  truncateTail,
} from '../truncate.ts'

describe('truncateHead', () => {
  test('no truncation when within both limits', () => {
    const content = 'line1\nline2\nline3'
    const result = truncateHead(content)
    expect(result.truncated).toBe(false)
    expect(result.content).toBe(content)
    expect(result.truncatedBy).toBeNull()
    expect(result.totalLines).toBe(3)
    expect(result.outputLines).toBe(3)
    expect(result.firstLineExceedsLimit).toBe(false)
    expect(result.lastLinePartial).toBe(false)
  })

  test('empty content returns not truncated', () => {
    const result = truncateHead('')
    expect(result.truncated).toBe(false)
    expect(result.content).toBe('')
    expect(result.totalLines).toBe(0)
    expect(result.outputLines).toBe(0)
  })

  test('truncates by line limit', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line${i}`)
    const content = lines.join('\n')
    const result = truncateHead(content, { maxLines: 10 })
    expect(result.truncated).toBe(true)
    expect(result.truncatedBy).toBe('lines')
    expect(result.outputLines).toBe(10)
    expect(result.content).toBe(lines.slice(0, 10).join('\n'))
    expect(result.totalLines).toBe(100)
  })

  test('truncates by byte limit', () => {
    // Many short lines whose total bytes exceed a small byte cap but line count is small.
    const lines = Array.from({ length: 50 }, () => 'x'.repeat(100))
    const content = lines.join('\n')
    const result = truncateHead(content, { maxBytes: 500 })
    expect(result.truncated).toBe(true)
    expect(result.truncatedBy).toBe('bytes')
    expect(Buffer.byteLength(result.content, 'utf-8')).toBeLessThanOrEqual(500)
    expect(result.outputLines).toBeLessThan(50)
  })

  test('first line exceeding byte limit returns empty content with firstLineExceedsLimit', () => {
    const bigLine = 'x'.repeat(DEFAULT_MAX_BYTES + 100)
    const content = `${bigLine}\nline2`
    const result = truncateHead(content)
    expect(result.truncated).toBe(true)
    expect(result.firstLineExceedsLimit).toBe(true)
    expect(result.content).toBe('')
    expect(result.outputLines).toBe(0)
    expect(result.outputBytes).toBe(0)
  })

  test('never splits a multibyte character — byte limit lands on a boundary', () => {
    // Each '✓' is 3 bytes in UTF-8. Use a byte cap that would land mid-character
    // if code-unit slicing were used.
    const chars = '✓'.repeat(100)
    const content = chars
    const result = truncateHead(content, { maxLines: Number.MAX_SAFE_INTEGER, maxBytes: 10 })
    expect(result.truncated).toBe(true)
    // 10 bytes / 3 bytes per char = 3 complete chars (9 bytes), 4th would be 12 > 10
    expect(Buffer.byteLength(result.content, 'utf-8')).toBeLessThanOrEqual(10)
    // The content must be valid complete '✓' characters
    expect(result.content).toMatch(/^✓*$/)
  })

  test('trailing newline does not create a phantom line', () => {
    const content = 'line1\nline2\n'
    const result = truncateHead(content)
    expect(result.totalLines).toBe(2)
    expect(result.truncated).toBe(false)
  })

  test('respects both custom maxLines and maxBytes', () => {
    const content = 'a\nb\nc\nd\ne'
    const result = truncateHead(content, { maxLines: 2, maxBytes: 1000 })
    expect(result.truncated).toBe(true)
    expect(result.truncatedBy).toBe('lines')
    expect(result.outputLines).toBe(2)
    expect(result.content).toBe('a\nb')
  })
})

describe('truncateTail', () => {
  test('no truncation when within both limits', () => {
    const content = 'line1\nline2\nline3'
    const result = truncateTail(content)
    expect(result.truncated).toBe(false)
    expect(result.content).toBe(content)
  })

  test('truncates by line limit — keeps the end', () => {
    const lines = Array.from({ length: 100 }, (_, i) => `line${i}`)
    const content = lines.join('\n')
    const result = truncateTail(content, { maxLines: 10 })
    expect(result.truncated).toBe(true)
    expect(result.outputLines).toBe(10)
    expect(result.content).toBe(lines.slice(-10).join('\n'))
  })

  test('truncates by byte limit — keeps the end', () => {
    const lines = Array.from({ length: 50 }, () => 'x'.repeat(100))
    const content = lines.join('\n')
    const result = truncateTail(content, { maxBytes: 500 })
    expect(result.truncated).toBe(true)
    expect(Buffer.byteLength(result.content, 'utf-8')).toBeLessThanOrEqual(500)
  })

  test('single line exceeding byte limit returns partial last line', () => {
    const bigLine = 'x'.repeat(DEFAULT_MAX_BYTES + 100)
    const result = truncateTail(bigLine)
    expect(result.truncated).toBe(true)
    expect(result.lastLinePartial).toBe(true)
    expect(Buffer.byteLength(result.content, 'utf-8')).toBeLessThanOrEqual(DEFAULT_MAX_BYTES)
    expect(result.content).toBe(bigLine.slice(-DEFAULT_MAX_BYTES))
  })

  test('multibyte tail — never splits a character', () => {
    const chars = '✓'.repeat(100)
    const result = truncateTail(chars, { maxLines: Number.MAX_SAFE_INTEGER, maxBytes: 10 })
    expect(result.truncated).toBe(true)
    expect(Buffer.byteLength(result.content, 'utf-8')).toBeLessThanOrEqual(10)
    expect(result.content).toMatch(/^✓*$/)
  })
})

describe('truncateLine', () => {
  test('short line is unchanged', () => {
    const result = truncateLine('hello')
    expect(result.wasTruncated).toBe(false)
    expect(result.text).toBe('hello')
  })

  test('long line is capped with truncated suffix', () => {
    const line = 'x'.repeat(GREP_MAX_LINE_LENGTH + 50)
    const result = truncateLine(line)
    expect(result.wasTruncated).toBe(true)
    expect(result.text).toBe(`${'x'.repeat(GREP_MAX_LINE_LENGTH)}... [truncated]`)
  })

  test('exactly at limit is not truncated', () => {
    const line = 'x'.repeat(GREP_MAX_LINE_LENGTH)
    const result = truncateLine(line)
    expect(result.wasTruncated).toBe(false)
    expect(result.text).toBe(line)
  })

  test('custom maxChars', () => {
    const result = truncateLine('abcdefghij', 5)
    expect(result.wasTruncated).toBe(true)
    expect(result.text).toBe('abcde... [truncated]')
  })
})

describe('formatSize', () => {
  test('bytes under 1KB', () => {
    expect(formatSize(0)).toBe('0B')
    expect(formatSize(512)).toBe('512B')
    expect(formatSize(1023)).toBe('1023B')
  })

  test('kilobytes', () => {
    expect(formatSize(1024)).toBe('1.0KB')
    expect(formatSize(DEFAULT_MAX_BYTES)).toBe('50.0KB')
  })

  test('megabytes', () => {
    expect(formatSize(1024 * 1024)).toBe('1.0MB')
    expect(formatSize(2 * 1024 * 1024)).toBe('2.0MB')
  })
})
