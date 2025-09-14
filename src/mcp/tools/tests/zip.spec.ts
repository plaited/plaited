import { describe, test, expect } from 'bun:test'
import { zip } from '../zip.js'

describe('zip', () => {
  test('should create gzipped response with basic parameters', async () => {
    const content = 'Hello, World!'
    const contentType = 'text/plain'

    const response = zip({ content, contentType })

    expect(response).toBeInstanceOf(Response)
    expect(response.headers.get('content-type')).toBe('text/plain')
    expect(response.headers.get('content-encoding')).toBe('gzip')
  })

  test('should compress content using gzip', async () => {
    const content = 'This is a test string that should be compressed'
    const contentType = 'text/plain'

    const response = zip({ content, contentType })
    const compressedBuffer = await response.arrayBuffer()

    // Compressed content should be different from original
    expect(compressedBuffer.byteLength).toBeGreaterThan(0)
    expect(new TextDecoder().decode(compressedBuffer)).not.toBe(content)
  })

  test('should be able to decompress gzipped content', async () => {
    const content = 'This is a test string for compression and decompression'
    const contentType = 'text/plain'

    const response = zip({ content, contentType })
    const compressedBuffer = await response.arrayBuffer()

    // Decompress using Bun's gunzipSync
    const decompressed = Bun.gunzipSync(new Uint8Array(compressedBuffer))
    const decompressedText = new TextDecoder().decode(decompressed)

    expect(decompressedText).toBe(content)
  })

  test('should handle different content types', async () => {
    const testCases = [
      { content: '{"key": "value"}', contentType: 'application/json' },
      { content: '<html><body>Test</body></html>', contentType: 'text/html' },
      { content: 'body { color: red; }', contentType: 'text/css' },
      { content: 'console.log("test");', contentType: 'application/javascript' }
    ]

    for (const { content, contentType } of testCases) {
      const response = zip({ content, contentType })

      expect(response.headers.get('content-type')).toBe(contentType)
      expect(response.headers.get('content-encoding')).toBe('gzip')
    }
  })

  test('should handle empty content', async () => {
    const content = ''
    const contentType = 'text/plain'

    const response = zip({ content, contentType })

    expect(response.headers.get('content-type')).toBe('text/plain')
    expect(response.headers.get('content-encoding')).toBe('gzip')

    // Even empty content should produce some gzip overhead
    const compressedBuffer = await response.arrayBuffer()
    expect(compressedBuffer.byteLength).toBeGreaterThan(0)

    // Should decompress to empty string
    const decompressed = Bun.gunzipSync(new Uint8Array(compressedBuffer))
    expect(new TextDecoder().decode(decompressed)).toBe('')
  })

  test('should handle very large content', async () => {
    // Create a large string (100KB)
    const content = 'A'.repeat(100 * 1024)
    const contentType = 'text/plain'

    const response = zip({ content, contentType })
    const compressedBuffer = await response.arrayBuffer()

    // Compression should significantly reduce size for repetitive content
    expect(compressedBuffer.byteLength).toBeLessThan(content.length)

    // Should still decompress correctly
    const decompressed = Bun.gunzipSync(new Uint8Array(compressedBuffer))
    expect(new TextDecoder().decode(decompressed)).toBe(content)
  })

  test('should work without custom headers', async () => {
    const content = 'Test without headers'
    const contentType = 'text/plain'

    const response = zip({ content, contentType })

    expect(response.headers.get('content-type')).toBe('text/plain')
    expect(response.headers.get('content-encoding')).toBe('gzip')
  })

  test('should append to existing headers when provided', async () => {
    const content = 'Test with custom headers'
    const contentType = 'application/json'
    const headers = new Headers()
    headers.set('X-Custom-Header', 'custom-value')
    headers.set('Cache-Control', 'no-cache')

    const response = zip({ content, contentType, headers })

    // Should have default headers
    expect(response.headers.get('content-type')).toBe('application/json')
    expect(response.headers.get('content-encoding')).toBe('gzip')

    // Should preserve custom headers
    expect(response.headers.get('X-Custom-Header')).toBe('custom-value')
    expect(response.headers.get('Cache-Control')).toBe('no-cache')
  })

  test('should handle headers object correctly when appending', async () => {
    const content = 'Test header appending'
    const contentType = 'text/html'
    const headers = new Headers()
    headers.set('X-Test', 'original-value')

    const response = zip({ content, contentType, headers })

    // Check that default headers were appended
    expect(response.headers.get('content-type')).toBe('text/html')
    expect(response.headers.get('content-encoding')).toBe('gzip')
    expect(response.headers.get('X-Test')).toBe('original-value')
  })

  test('should handle special characters in content', async () => {
    const content = 'Special chars: 🎉 áéíóú ñ ¿¡ 中文 עברית'
    const contentType = 'text/plain; charset=utf-8'

    const response = zip({ content, contentType })
    const compressedBuffer = await response.arrayBuffer()

    // Should decompress correctly with UTF-8 content
    const decompressed = Bun.gunzipSync(new Uint8Array(compressedBuffer))
    const decompressedText = new TextDecoder().decode(decompressed)

    expect(decompressedText).toBe(content)
  })

  test('should handle JSON content correctly', async () => {
    const jsonObject = {
      name: 'test',
      data: [1, 2, 3],
      nested: { key: 'value' },
      unicode: '🚀'
    }
    const content = JSON.stringify(jsonObject)
    const contentType = 'application/json'

    const response = zip({ content, contentType })
    const compressedBuffer = await response.arrayBuffer()

    // Decompress and parse JSON
    const decompressed = Bun.gunzipSync(new Uint8Array(compressedBuffer))
    const decompressedText = new TextDecoder().decode(decompressed)
    const parsedJson = JSON.parse(decompressedText)

    expect(parsedJson).toEqual(jsonObject)
  })

  test('should produce consistent compression for same input', async () => {
    const content = 'Consistent compression test'
    const contentType = 'text/plain'

    const response1 = zip({ content, contentType })
    const response2 = zip({ content, contentType })

    const buffer1 = await response1.arrayBuffer()
    const buffer2 = await response2.arrayBuffer()

    // Gzip should produce identical output for identical input
    expect(buffer1.byteLength).toBe(buffer2.byteLength)
    expect(new Uint8Array(buffer1)).toEqual(new Uint8Array(buffer2))
  })

  test('should handle content with newlines and whitespace', async () => {
    const content = `
      This is a multi-line string
      with various types of whitespace:

      - Spaces
      - Tabs\t\t
      - Newlines

      And some indentation.
    `
    const contentType = 'text/plain'

    const response = zip({ content, contentType })
    const compressedBuffer = await response.arrayBuffer()

    const decompressed = Bun.gunzipSync(new Uint8Array(compressedBuffer))
    const decompressedText = new TextDecoder().decode(decompressed)

    expect(decompressedText).toBe(content)
  })

  test('should properly set response properties', async () => {
    const content = 'Response property test'
    const contentType = 'application/xml'

    const response = zip({ content, contentType })

    // Response should have proper properties
    expect(response.ok).toBe(true)
    expect(response.status).toBe(200)
    expect(response.body).not.toBeNull()
    expect(response.bodyUsed).toBe(false)
  })
})
