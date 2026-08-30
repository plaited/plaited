import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { ImageContentSchema, MessageItemParamSchema } from '../../agent/open-responses.schemas.ts'
import binaryTool, { DEFAULT_MAX_BINARY_BYTES, detectMimeType } from '../binary.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// MIME detection — offset-aware magic bytes
// ================================================================

describe('detectMimeType', () => {
  // --- Image formats ---
  test('detects JPEG from magic bytes ff d8 ff', () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46])
    expect(detectMimeType(bytes)).toBe('image/jpeg')
  })

  test('detects PNG from magic bytes', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
    expect(detectMimeType(bytes)).toBe('image/png')
  })

  test('detects GIF from magic bytes', () => {
    const bytes = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
    expect(detectMimeType(bytes)).toBe('image/gif')
  })

  test('detects WebP from RIFF+WEBP at offset 8', () => {
    // RIFF header + WEBP tag at offset 8
    const bytes = new Uint8Array(20)
    bytes[0] = 0x52 // R
    bytes[1] = 0x49 // I
    bytes[2] = 0x46 // F
    bytes[3] = 0x46 // F
    bytes[8] = 0x57 // W
    bytes[9] = 0x45 // E
    bytes[10] = 0x42 // B
    bytes[11] = 0x50 // P
    expect(detectMimeType(bytes)).toBe('image/webp')
  })

  test('detects BMP with structural prefix check', () => {
    // BMP starts with "BM" and bytes 2-4 are the file size — plain text "BM" at
    // start is excluded by requiring a reasonable size (≥14 bytes for header)
    const bytes = new Uint8Array(30)
    bytes[0] = 0x42 // B
    bytes[1] = 0x4d // M
    bytes[2] = 30 // file size (30 bytes)
    bytes[3] = 0
    bytes[4] = 0
    bytes[5] = 0
    expect(detectMimeType(bytes)).toBe('image/bmp')
  })

  test('does not misdetect plain text "BM" as BMP', () => {
    const bytes = new Uint8Array([0x42, 0x4d, 0x00, 0x00, 0x00])
    expect(detectMimeType(bytes)).toBe('application/octet-stream')
  })

  // --- Audio formats ---
  test('detects MP3 ID3v2 from 49 44 33', () => {
    const bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00])
    expect(detectMimeType(bytes)).toBe('audio/mpeg')
  })

  test('detects MP3 sync frame from ff fb', () => {
    const bytes = new Uint8Array([0xff, 0xfb, 0x90, 0x00])
    expect(detectMimeType(bytes)).toBe('audio/mpeg')
  })

  test('detects WAV from RIFF+WAVE at offset 8', () => {
    const bytes = new Uint8Array(16)
    bytes[0] = 0x52 // R
    bytes[1] = 0x49 // I
    bytes[2] = 0x46 // F
    bytes[3] = 0x46 // F
    bytes[8] = 0x57 // W
    bytes[9] = 0x41 // A
    bytes[10] = 0x56 // V
    bytes[11] = 0x45 // E
    expect(detectMimeType(bytes)).toBe('audio/wav')
  })

  test('detects OGG from 4f 67 67 53', () => {
    const bytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 0x00])
    expect(detectMimeType(bytes)).toBe('audio/ogg')
  })

  test('detects FLAC from 66 4c 61 43', () => {
    const bytes = new Uint8Array([0x66, 0x4c, 0x61, 0x43, 0x00])
    expect(detectMimeType(bytes)).toBe('audio/flac')
  })

  test('detects AAC ADTS from ff f1', () => {
    const bytes = new Uint8Array([0xff, 0xf1, 0x50, 0x80])
    expect(detectMimeType(bytes)).toBe('audio/aac')
  })

  // --- Video formats ---
  test('detects MP4 from ftyp at offset 4', () => {
    // ftyp box: length 24 (0x18), 'ftyp' at offset 4
    const bytes = new Uint8Array(16)
    bytes[0] = 0x00
    bytes[1] = 0x00
    bytes[2] = 0x00
    bytes[3] = 0x18 // box length = 24
    bytes[4] = 0x66 // f
    bytes[5] = 0x74 // t
    bytes[6] = 0x79 // y
    bytes[7] = 0x70 // p
    bytes[8] = 0x69 // i (isom brand)
    bytes[9] = 0x73
    bytes[10] = 0x6f
    bytes[11] = 0x6d
    expect(detectMimeType(bytes)).toBe('video/mp4')
  })

  test('detects MP4 with alternate ftyp lengths (0x1c, 0x20)', () => {
    const bytes1 = new Uint8Array(16)
    bytes1[0] = 0x00
    bytes1[1] = 0x00
    bytes1[2] = 0x00
    bytes1[3] = 0x1c
    bytes1[4] = 0x66
    bytes1[5] = 0x74
    bytes1[6] = 0x79
    bytes1[7] = 0x70
    expect(detectMimeType(bytes1)).toBe('video/mp4')

    const bytes2 = new Uint8Array(16)
    bytes2[0] = 0x00
    bytes2[1] = 0x00
    bytes2[2] = 0x00
    bytes2[3] = 0x20
    bytes2[4] = 0x66
    bytes2[5] = 0x74
    bytes2[6] = 0x79
    bytes2[7] = 0x70
    expect(detectMimeType(bytes2)).toBe('video/mp4')
  })

  test('detects WebM from 1a 45 df a3', () => {
    const bytes = new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])
    expect(detectMimeType(bytes)).toBe('video/webm')
  })

  test('detects AVI from RIFF+AVI at offset 8', () => {
    const bytes = new Uint8Array(16)
    bytes[0] = 0x52 // R
    bytes[1] = 0x49 // I
    bytes[2] = 0x46 // F
    bytes[3] = 0x46 // F
    bytes[8] = 0x41 // A
    bytes[9] = 0x56 // V
    bytes[10] = 0x49 // I
    bytes[11] = 0x20 // space
    expect(detectMimeType(bytes)).toBe('video/avi')
  })

  test('detects QuickTime from ftypqt variants', () => {
    const bytes = new Uint8Array(16)
    bytes[0] = 0x00
    bytes[1] = 0x00
    bytes[2] = 0x00
    bytes[3] = 0x14
    bytes[4] = 0x66 // f
    bytes[5] = 0x74 // t
    bytes[6] = 0x79 // y
    bytes[7] = 0x70 // p
    bytes[8] = 0x71 // q
    bytes[9] = 0x74 // t
    bytes[10] = 0x20 // space
    expect(detectMimeType(bytes)).toBe('video/quicktime')
  })

  test('falls back to application/octet-stream for unknown bytes', () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03])
    expect(detectMimeType(bytes)).toBe('application/octet-stream')
  })

  test('returns octet-stream for very short buffers that cannot match any header', () => {
    const bytes = new Uint8Array([0x00])
    expect(detectMimeType(bytes)).toBe('application/octet-stream')
  })

  // --- RIFF container disambiguation ---
  test('RIFF+WEBP is image/webp, not WAV or AVI', () => {
    const bytes = new Uint8Array(20)
    bytes[0] = 0x52
    bytes[1] = 0x49
    bytes[2] = 0x46
    bytes[3] = 0x46
    bytes[8] = 0x57
    bytes[9] = 0x45
    bytes[10] = 0x42
    bytes[11] = 0x50
    expect(detectMimeType(bytes)).toBe('image/webp')
  })

  test('RIFF+WAVE is audio/wav, not WebP or AVI', () => {
    const bytes = new Uint8Array(16)
    bytes[0] = 0x52
    bytes[1] = 0x49
    bytes[2] = 0x46
    bytes[3] = 0x46
    bytes[8] = 0x57
    bytes[9] = 0x41
    bytes[10] = 0x56
    bytes[11] = 0x45
    expect(detectMimeType(bytes)).toBe('audio/wav')
  })
})

// ================================================================
// Binary tool — run function
// ================================================================

describe('binary tool', () => {
  test('reads a real small JPEG file correctly', async () => {
    // Minimal valid JPEG (65 bytes) — SOI + APP0 + DQT + SOF0 + SOS + EOI
    const jpegBytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
      0x00, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08,
      0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a,
      0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34,
      0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00,
      0x01, 0x00, 0x01, 0x01, 0x11, 0x00, 0x03, 0x00, 0x00, 0x00, 0x00, 0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05,
      0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06,
      0x07, 0x08, 0x09, 0x0a, 0x0b, 0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3f, 0x00, 0xfe, 0x00, 0x00,
    ])

    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'test.jpg')
    await Bun.write(filePath, jpegBytes)

    try {
      const result = await binaryTool.run({ path: filePath })

      expect(result.isError).toBeUndefined()
      expect(result.mimeType).toBe('image/jpeg')
      expect(typeof result.base64).toBe('string')
      expect(result.base64.length).toBeGreaterThan(0)
      expect(result.bytesRead).toBe(jpegBytes.length)

      // Data-URI readiness: base64 should be the plain encoded value
      const expectedBase64 = Buffer.from(jpegBytes).toString('base64')
      expect(result.base64).toBe(expectedBase64)
    } finally {
      await cleanup()
    }
  })

  test('reads a PNG file and returns image dimensions', async () => {
    // Minimal 1x1 PNG (67 bytes)
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49,
      0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x83, 0x30, 0x5e,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ])

    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'test.png')
    await Bun.write(filePath, pngBytes)

    try {
      const result = await binaryTool.run({ path: filePath })

      expect(result.isError).toBeUndefined()
      expect(result.mimeType).toBe('image/png')
      expect(typeof result.base64).toBe('string')
      expect(result.bytesRead).toBe(pngBytes.length)

      // Image dimensions should be present for a valid PNG
      expect(result.width).toBe(1)
      expect(result.height).toBe(1)
      expect(result.imageFormat).toBe('png')
    } finally {
      await cleanup()
    }
  })

  test('file not found returns isError with message', async () => {
    const result = await binaryTool.run({ path: '/tmp/nonexistent-binary-xyz-123' })
    expect(result.isError).toBe(true)
    expect(result.message).toContain('not found')
    expect(result.mimeType).toBe('application/octet-stream')
    expect(result.bytesRead).toBe(0)
    expect(result.base64).toBe('')
  })

  test('directory path returns isError with message', async () => {
    // Use process cwd as a directory fixture
    const result = await binaryTool.run({ path: process.cwd() })
    expect(result.isError).toBe(true)
    expect(result.message).toContain('directory')
    expect(result.bytesRead).toBe(0)
    expect(result.base64).toBe('')
  })

  test('file over default ceiling returns isError', async () => {
    // Write a file larger than DEFAULT_MAX_BINARY_BYTES
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'large.bin')
    const largeBytes = new Uint8Array(DEFAULT_MAX_BINARY_BYTES + 1)
    largeBytes.fill(0x00)
    // Make it look like octet-stream
    await Bun.write(filePath, largeBytes)

    try {
      const result = await binaryTool.run({ path: filePath })
      expect(result.isError).toBe(true)
      expect(result.mimeType).toBe('application/octet-stream')
      expect(result.bytesRead).toBe(0)
      expect(result.base64).toBe('')
      // Error message must name the limit (Phase 7 declared-capabilities principle)
      expect(result.message).toContain(String(DEFAULT_MAX_BINARY_BYTES))
    } finally {
      await cleanup()
    }
  })

  test('file under default ceiling reads successfully', async () => {
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'small.bin')
    const smallBytes = new Uint8Array(128)
    smallBytes.fill(0x42)
    await Bun.write(filePath, smallBytes)

    try {
      const result = await binaryTool.run({ path: filePath })
      expect(result.isError).toBeUndefined()
      expect(result.bytesRead).toBe(128)
      expect(result.base64).toBe(Buffer.from(smallBytes).toString('base64'))
    } finally {
      await cleanup()
    }
  })

  test('provision-time maxBytes overrides default ceiling', async () => {
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'medium.bin')
    const mediumBytes = new Uint8Array(512)
    mediumBytes.fill(0x42)
    await Bun.write(filePath, mediumBytes)

    try {
      // Pass provision-time maxBytes of 256 — file is 512 bytes, should be rejected
      const result = await binaryTool.run({ path: filePath, maxBytes: 256 })
      expect(result.isError).toBe(true)
      expect(result.bytesRead).toBe(0)
    } finally {
      await cleanup()
    }
  })

  test('provision-time maxBytes allows files under the limit', async () => {
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'small.bin')
    const smallBytes = new Uint8Array(100)
    smallBytes.fill(0x42)
    await Bun.write(filePath, smallBytes)

    try {
      const result = await binaryTool.run({ path: filePath, maxBytes: 256 })
      expect(result.isError).toBeUndefined()
      expect(result.bytesRead).toBe(100)
    } finally {
      await cleanup()
    }
  })

  test('rejects empty string path with isError', async () => {
    const result = await binaryTool.run({ path: '' })
    expect(result.isError).toBe(true)
  })
})

// ================================================================
// Input/Output schema validation
// ================================================================

describe('binary tool schema', () => {
  test('inputSchema parses a valid path', () => {
    const parsed = binaryTool.inputSchema.parse({ path: '/path/to/file.jpg' })
    expect(parsed.path).toBe('/path/to/file.jpg')
  })

  test('inputSchema rejects an empty path', () => {
    expect(() => binaryTool.inputSchema.parse({ path: '' })).toThrow()
  })

  test('inputSchema requires path', () => {
    expect(() => binaryTool.inputSchema.parse({})).toThrow()
  })

  test('outputSchema validates the result shape', () => {
    const result = {
      mimeType: 'image/jpeg',
      base64: 'AAAA',
      bytesRead: 4,
    }
    const parsed = binaryTool.outputSchema.parse(result)
    expect(parsed.mimeType).toBe('image/jpeg')
    expect(parsed.base64).toBe('AAAA')
    expect(parsed.bytesRead).toBe(4)
  })

  test('outputSchema validates result with dimensions', () => {
    const result = {
      mimeType: 'image/png',
      base64: 'AAAA',
      bytesRead: 67,
      width: 1,
      height: 1,
      imageFormat: 'png',
    }
    const parsed = binaryTool.outputSchema.parse(result)
    expect(parsed.width).toBe(1)
    expect(parsed.height).toBe(1)
    expect(parsed.imageFormat).toBe('png')
  })

  test('outputSchema validates error result', () => {
    const result = {
      mimeType: 'application/octet-stream',
      base64: '',
      bytesRead: 0,
      isError: true,
    }
    const parsed = binaryTool.outputSchema.parse(result)
    expect(parsed.isError).toBe(true)
  })
})

// ================================================================
// Integration: binary tool output → image content part
// ================================================================

describe('binary tool → image content part integration', () => {
  test('reads a PNG and constructs an ImageContent data-URI that schema accepts', async () => {
    // Minimal 1x1 PNG
    const pngBytes = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00,
      0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde, 0x00, 0x00, 0x00, 0x0c, 0x49,
      0x44, 0x41, 0x54, 0x08, 0xd7, 0x63, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01, 0x27, 0x83, 0x30, 0x5e,
      0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ])
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'test.png')
    await Bun.write(filePath, pngBytes)

    try {
      // 1. Read binary file via binary tool
      const { mimeType, base64, width, height, imageFormat } = await binaryTool.run({ path: filePath })

      expect(mimeType).toBe('image/png')
      expect(typeof base64).toBe('string')
      expect(base64.length).toBeGreaterThan(0)
      expect(width).toBe(1)
      expect(height).toBe(1)
      expect(imageFormat).toBe('png')

      // 2. Construct data-URI from binary tool output
      const dataUri = `data:${mimeType};base64,${base64}`

      // 3. Build the image content part — this is the handler pattern
      //    that switches on mimeType.startsWith('image/')
      const imagePart = ImageContentSchema.parse({
        type: 'image',
        image_url: { url: dataUri },
      })
      expect(imagePart.type).toBe('image')
      expect(imagePart.image_url.url).toBe(dataUri)

      // 4. Create a full message item param with the image content
      const msg = MessageItemParamSchema.parse({
        type: 'message',
        role: 'user',
        content: [imagePart],
      })
      expect(Array.isArray(msg.content)).toBe(true)
      expect(msg.content).toHaveLength(1)
    } finally {
      await cleanup()
    }
  })
})
