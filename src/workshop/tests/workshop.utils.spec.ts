import { expect, test } from 'bun:test'
import { join } from 'node:path'
import { formatErrorType, globFiles, splitIntoBatches, zip } from '../workshop.utils.ts'

const FIXTURES_DIR = join(import.meta.dir, 'fixtures')

test('splitIntoBatches: should split array into equal batches', () => {
  const result = splitIntoBatches([1, 2, 3, 4, 5, 6], 3)
  expect(result).toEqual([
    [1, 2, 3],
    [4, 5, 6],
  ])
})

test('splitIntoBatches: should handle remainder in last batch', () => {
  const result = splitIntoBatches([1, 2, 3, 4, 5], 2)
  expect(result).toEqual([[1, 2], [3, 4], [5]])
})

test('splitIntoBatches: should return empty array for empty input', () => {
  const result = splitIntoBatches([], 5)
  expect(result).toEqual([])
})

test('splitIntoBatches: should create single batch when itemsPerBatch >= length', () => {
  const result = splitIntoBatches([1, 2, 3], 5)
  expect(result).toEqual([[1, 2, 3]])
})

test('splitIntoBatches: should handle itemsPerBatch = 1', () => {
  const result = splitIntoBatches([1, 2, 3], 1)
  expect(result).toEqual([[1], [2], [3]])
})

test('splitIntoBatches: should work with any type', () => {
  const strings = ['a', 'b', 'c', 'd', 'e']
  const result = splitIntoBatches(strings, 2)
  expect(result).toEqual([['a', 'b'], ['c', 'd'], ['e']])
})

test('splitIntoBatches: should work with objects', () => {
  type Item = { id: number; name: string }
  const items: Item[] = [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' },
    { id: 3, name: 'c' },
  ]
  const result = splitIntoBatches(items, 2)
  expect(result).toEqual([
    [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ],
    [{ id: 3, name: 'c' }],
  ])
})

test('formatErrorType: should format timeout_error', () => {
  const result = formatErrorType('timeout_error')
  expect(result).toBe('🚩 Timeout Error')
})

test('formatErrorType: should format unknown_error', () => {
  const result = formatErrorType('unknown_error')
  expect(result).toBe('🚩 Unknown Error')
})

test('formatErrorType: should format single word', () => {
  const result = formatErrorType('error')
  expect(result).toBe('🚩 Error')
})

test('formatErrorType: should capitalize each word after splitting on underscore', () => {
  const result = formatErrorType('network_connection_error')
  expect(result).toBe('🚩 Network Connection Error')
})

test('formatErrorType: should handle multiple underscores', () => {
  const result = formatErrorType('very_long_error_type_name')
  expect(result).toBe('🚩 Very Long Error Type Name')
})

test('formatErrorType: should add 🚩 emoji prefix', () => {
  const result = formatErrorType('test')
  expect(result).toMatch(/^🚩 /)
})

test('formatErrorType: should handle empty string', () => {
  const result = formatErrorType('')
  expect(result).toBe('🚩 ')
})

test('formatErrorType: should preserve case in first letter of each word', () => {
  const result = formatErrorType('test_error')
  expect(result).toBe('🚩 Test Error')
})

// globFiles() tests
test('globFiles: should find files matching glob pattern', async () => {
  const files = await globFiles(FIXTURES_DIR, '**/*.stories.tsx')
  expect(files.length).toBeGreaterThan(0)
  expect(files.every((f) => f.endsWith('.stories.tsx'))).toBe(true)
})

test('globFiles: should support ** for recursive search', async () => {
  const files = await globFiles(FIXTURES_DIR, '**/*.stories.tsx')
  // Should find files in nested directories
  const hasNested = files.some((f) => f.includes('/nested/'))
  expect(hasNested).toBe(true)
})

test('globFiles: should support * wildcard', async () => {
  const files = await globFiles(FIXTURES_DIR, '*.stories.tsx')
  // Should only find files at root level (no nested)
  expect(files.every((f) => !f.includes('/nested/'))).toBe(true)
})

test('globFiles: should return absolute paths', async () => {
  const files = await globFiles(FIXTURES_DIR, '**/*.stories.tsx')
  expect(files.every((f) => f.startsWith('/'))).toBe(true)
})

test('globFiles: should return empty array when no matches', async () => {
  const files = await globFiles(FIXTURES_DIR, '**/*.nonexistent')
  expect(Array.isArray(files)).toBe(true)
  expect(files.length).toBe(0)
})

test('globFiles: should handle cwd parameter', async () => {
  const files = await globFiles(join(FIXTURES_DIR, 'stories'), '*.stories.tsx')
  expect(files.length).toBeGreaterThan(0)
  expect(files.every((f) => f.includes('/stories/'))).toBe(true)
})

// zip() tests
test('zip: should return original response when compress=false', async () => {
  const content = 'Hello, World!'
  const response = zip({ content, contentType: 'text/plain', compress: false })

  expect(response).toBeInstanceOf(Response)
  expect(response.headers.get('content-type')).toBe('text/plain')
  expect(response.headers.get('content-encoding')).toBeNull()

  const text = await response.text()
  expect(text).toBe(content)
})

test('zip: should compress response when compress=true', async () => {
  const content = 'Hello, World!'
  const response = zip({ content, contentType: 'text/plain', compress: true })

  expect(response).toBeInstanceOf(Response)
  expect(response.headers.get('content-type')).toBe('text/plain')
  expect(response.headers.get('content-encoding')).toBe('gzip')

  // Response body should be gzipped - verify with magic bytes
  const arrayBuffer = await response.arrayBuffer()
  expect(arrayBuffer.byteLength).toBeGreaterThan(0)
  const bytes = new Uint8Array(arrayBuffer)
  // Gzip magic bytes are 0x1f 0x8b
  expect(bytes[0]).toBe(0x1f)
  expect(bytes[1]).toBe(0x8b)
})

test('zip: should set content-encoding header to gzip when compressed', () => {
  const response = zip({ content: 'test', contentType: 'text/plain', compress: true })
  expect(response.headers.get('content-encoding')).toBe('gzip')
})

test('zip: should preserve content-type header', () => {
  const response1 = zip({ content: 'test', contentType: 'application/json', compress: false })
  expect(response1.headers.get('content-type')).toBe('application/json')

  const response2 = zip({ content: 'test', contentType: 'text/html', compress: true })
  expect(response2.headers.get('content-type')).toBe('text/html')
})

test('zip: should handle empty response body', async () => {
  const response = zip({ content: '', contentType: 'text/plain', compress: false })
  const text = await response.text()
  expect(text).toBe('')
})

test('zip: should gzip text responses', async () => {
  const content = 'This is a test string that should be compressed'
  const response = zip({ content, contentType: 'text/plain', compress: true })

  expect(response.headers.get('content-encoding')).toBe('gzip')

  // Verify it's actually gzipped by checking the magic bytes
  const arrayBuffer = await response.arrayBuffer()
  const bytes = new Uint8Array(arrayBuffer)
  // Gzip magic bytes are 0x1f 0x8b
  expect(bytes[0]).toBe(0x1f)
  expect(bytes[1]).toBe(0x8b)
})

test('zip: should default to compress=false when not specified', async () => {
  const content = 'test'
  const response = zip({ content, contentType: 'text/plain' })

  expect(response.headers.get('content-encoding')).toBeNull()
  const text = await response.text()
  expect(text).toBe(content)
})
