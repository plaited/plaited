import { test, expect } from 'bun:test'
import { zip } from '../zip.js'

test('zip: compresses content with gzip', async () => {
  const content = 'Hello, World!'
  const contentType = 'text/plain'

  const response = zip({ content, contentType })

  expect(response).toBeInstanceOf(Response)

  // Verify response body is compressed
  const buffer = await response.arrayBuffer()
  expect(buffer.byteLength).toBeGreaterThan(0)

  // Verify we can decompress it
  const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
  const text = new TextDecoder().decode(decompressed)
  expect(text).toBe(content)
})

test('zip: sets content-type header correctly', () => {
  const content = '<html><body>Test</body></html>'
  const contentType = 'text/html;charset=utf-8'

  const response = zip({ content, contentType })

  expect(response.headers.get('content-type')).toBe(contentType)
})

test('zip: sets content-encoding header to gzip', () => {
  const content = 'Test content'
  const contentType = 'text/plain'

  const response = zip({ content, contentType })

  expect(response.headers.get('content-encoding')).toBe('gzip')
})

test('zip: uses default headers when no custom headers provided', () => {
  const content = 'Test'
  const contentType = 'application/javascript'

  const response = zip({ content, contentType })

  expect(response.headers.get('content-type')).toBe(contentType)
  expect(response.headers.get('content-encoding')).toBe('gzip')
  expect(response.headers.has('custom-header')).toBe(false)
})

test('zip: merges custom headers with default headers', () => {
  const content = 'Test with custom headers'
  const contentType = 'application/json'
  const headers = new Headers()
  headers.set('x-custom-header', 'custom-value')
  headers.set('cache-control', 'no-cache')

  const response = zip({ content, contentType, headers })

  // Verify default headers are present
  expect(response.headers.get('content-type')).toBe(contentType)
  expect(response.headers.get('content-encoding')).toBe('gzip')

  // Verify custom headers are present
  expect(response.headers.get('x-custom-header')).toBe('custom-value')
  expect(response.headers.get('cache-control')).toBe('no-cache')
})

test('zip: handles large content efficiently', async () => {
  const largeContent = 'x'.repeat(10000)
  const contentType = 'text/plain'

  const response = zip({ content: largeContent, contentType })

  // Compressed size should be smaller than original
  const buffer = await response.arrayBuffer()
  expect(buffer.byteLength).toBeLessThan(largeContent.length)

  // Verify decompression works
  const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
  const text = new TextDecoder().decode(decompressed)
  expect(text).toBe(largeContent)
})

test('zip: handles empty content', async () => {
  const content = ''
  const contentType = 'text/plain'

  const response = zip({ content, contentType })

  expect(response).toBeInstanceOf(Response)

  const buffer = await response.arrayBuffer()
  const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
  const text = new TextDecoder().decode(decompressed)
  expect(text).toBe('')
})

test('zip: handles various content types', async () => {
  const testCases = [
    { content: '{"key":"value"}', contentType: 'application/json' },
    { content: '<svg></svg>', contentType: 'image/svg+xml' },
    { content: 'const x = 1;', contentType: 'application/javascript' },
    { content: 'body { color: red; }', contentType: 'text/css' },
  ]

  for (const { content, contentType } of testCases) {
    const response = zip({ content, contentType })

    expect(response.headers.get('content-type')).toBe(contentType)
    expect(response.headers.get('content-encoding')).toBe('gzip')

    const buffer = await response.arrayBuffer()
    const decompressed = Bun.gunzipSync(new Uint8Array(buffer))
    const text = new TextDecoder().decode(decompressed)
    expect(text).toBe(content)
  }
})

test('zip: custom headers do not override default headers', () => {
  const content = 'Test'
  const contentType = 'text/plain'
  const headers = new Headers()
  headers.set('x-custom', 'value')

  const response = zip({ content, contentType, headers })

  // Default headers should still be present and correct
  expect(response.headers.get('content-type')).toBe(contentType)
  expect(response.headers.get('content-encoding')).toBe('gzip')
  expect(response.headers.get('x-custom')).toBe('value')
})
