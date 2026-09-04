import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { Client } from '@modelcontextprotocol/client'
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server'
import { BINARY_TOOL_NAME, binary, DEFAULT_MAX_BINARY_BYTES, detectMimeType } from '../binary.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// MIME detection — offset-aware magic bytes (pure function tests)
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
// Binary tool — exercised through an in-process MCP client/server
// ================================================================

let server: McpServer
let client: Client
let cleanupClosable: (() => Promise<void>) | undefined

const setupServer = async () => {
  server = new McpServer({ name: 'test', version: '0.0.0' })
  binary(server)

  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)

  client = new Client({ name: 'test-client', version: '0.0.0' }, { capabilities: {} })
  await client.connect(clientTransport)

  cleanupClosable = async () => {
    await client.close()
  }
}

const callBinary = async (args: Record<string, unknown>) => {
  const result = await client.callTool({ name: BINARY_TOOL_NAME, arguments: args })
  return result
}

type BinaryToolOutput = {
  mimeType: string
  base64: string
  width?: number
  height?: number
  imageFormat?: string
  bytesRead: number
  message?: string
  isError?: boolean
}

describe('binary tool', () => {
  beforeEach(async () => {
    await setupServer()
  })

  afterEach(async () => {
    await cleanupClosable?.()
  })

  test('listTools includes binary', async () => {
    const { tools } = await client.listTools()
    const tool = tools.find((t) => t.name === BINARY_TOOL_NAME)
    expect(tool).toBeDefined()
    expect(tool!.description).toContain('Read a binary file')
  })

  test('reads a real small JPEG file correctly', async () => {
    const fixturePath = path.join(import.meta.dir, 'fixtures', '1x1.jpg')
    const jpegBytes = await Bun.file(fixturePath).bytes()
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'test.jpg')
    await Bun.write(filePath, jpegBytes)

    try {
      const result = await callBinary({ path: filePath, cwd: process.cwd() })
      const data = result.structuredContent as BinaryToolOutput

      expect(data.isError).toBeUndefined()
      expect(data.mimeType).toBe('image/jpeg')
      expect(typeof data.base64).toBe('string')
      expect(data.base64.length).toBeGreaterThan(0)
      expect(data.bytesRead).toBe(jpegBytes.length)

      const expectedBase64 = Buffer.from(jpegBytes).toString('base64')
      expect(data.base64).toBe(expectedBase64)
      expect(data.width).toBe(1)
      expect(data.height).toBe(1)
      expect(data.imageFormat).toBe('jpeg')
    } finally {
      await cleanup()
    }
  })

  test('reads a PNG file and returns image dimensions', async () => {
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
      const result = await callBinary({ path: filePath, cwd: process.cwd() })
      const data = result.structuredContent as BinaryToolOutput

      expect(data.isError).toBeUndefined()
      expect(data.mimeType).toBe('image/png')
      expect(typeof data.base64).toBe('string')
      expect(data.bytesRead).toBe(pngBytes.length)
      expect(data.width).toBe(1)
      expect(data.height).toBe(1)
      expect(data.imageFormat).toBe('png')
    } finally {
      await cleanup()
    }
  })

  test('file not found returns isError with message', async () => {
    const result = await callBinary({ path: '/tmp/nonexistent-binary-xyz-123', cwd: process.cwd() })
    const data = result.structuredContent as BinaryToolOutput
    expect(data.isError).toBe(true)
    expect(data.message).toContain('not found')
    expect(data.mimeType).toBe('application/octet-stream')
    expect(data.bytesRead).toBe(0)
    expect(data.base64).toBe('')
  })

  test('directory path returns isError with message', async () => {
    const result = await callBinary({ path: process.cwd(), cwd: process.cwd() })
    const data = result.structuredContent as BinaryToolOutput
    expect(data.isError).toBe(true)
    expect(data.message).toContain('directory')
    expect(data.bytesRead).toBe(0)
    expect(data.base64).toBe('')
  })

  test('file over default ceiling returns isError', async () => {
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'large.bin')
    const largeBytes = new Uint8Array(DEFAULT_MAX_BINARY_BYTES + 1)
    largeBytes.fill(0x00)
    await Bun.write(filePath, largeBytes)

    try {
      const result = await callBinary({ path: filePath, cwd: process.cwd() })
      const data = result.structuredContent as BinaryToolOutput
      expect(data.isError).toBe(true)
      expect(data.mimeType).toBe('application/octet-stream')
      expect(data.bytesRead).toBe(0)
      expect(data.base64).toBe('')
      expect(data.message).toContain(String(DEFAULT_MAX_BINARY_BYTES))
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
      const result = await callBinary({ path: filePath, cwd: process.cwd() })
      const data = result.structuredContent as BinaryToolOutput
      expect(data.isError).toBeUndefined()
      expect(data.bytesRead).toBe(128)
      expect(data.base64).toBe(Buffer.from(smallBytes).toString('base64'))
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
      const result = await callBinary({ path: filePath, maxBytes: 256, cwd: process.cwd() })
      const data = result.structuredContent as BinaryToolOutput
      expect(data.isError).toBe(true)
      expect(data.bytesRead).toBe(0)
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
      const result = await callBinary({ path: filePath, maxBytes: 256, cwd: process.cwd() })
      const data = result.structuredContent as BinaryToolOutput
      expect(data.isError).toBeUndefined()
      expect(data.bytesRead).toBe(100)
    } finally {
      await cleanup()
    }
  })

  test('rejects empty string path with isError', async () => {
    const result = await callBinary({ path: '', cwd: process.cwd() })
    const data = result.structuredContent as BinaryToolOutput
    expect(data.isError).toBe(true)
  })
})
