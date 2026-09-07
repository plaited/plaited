import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { DEFAULT_MAX_BINARY_BYTES, detectMimeType, MAX_BYTES, MAX_LINES, read } from '../read.ts'
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
// read tool — text branch (direct calls)
// ================================================================

describe('read tool — text branch', () => {
  test('reads a text file as a single input_text content-part', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'hello\nworld\nthird line' })
    try {
      const result = await read({ cwd: process.cwd(), path: path.join(dir, 'test.txt') })
      expect(result.isError).toBeUndefined()
      expect(result.truncated).toBe(false)
      expect(result.content).toHaveLength(1)
      expect(result.content[0]!.type).toBe('input_text')
      expect((result.content[0] as { text: string }).text).toBe('hello\nworld\nthird line')
    } finally {
      await cleanup()
    }
  })

  test('offset reads from a specific line (1-indexed)', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'line1\nline2\nline3\nline4' })
    try {
      const result = await read({ cwd: process.cwd(), path: path.join(dir, 'test.txt'), offset: 2 })
      expect(result.truncated).toBe(false)
      expect((result.content[0] as { text: string }).text).toBe('line2\nline3\nline4')
    } finally {
      await cleanup()
    }
  })

  test('offset + limit windows correctly', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'line1\nline2\nline3\nline4\nline5' })
    try {
      const result = await read({
        cwd: process.cwd(),
        path: path.join(dir, 'test.txt'),
        offset: 2,
        limit: 2,
      })
      expect(result.truncated).toBe(false)
      expect((result.content[0] as { text: string }).text).toBe('line2\nline3')
    } finally {
      await cleanup()
    }
  })

  test('truncates when the window exceeds MAX_BYTES', async () => {
    // Build a single line well over 50 KB so byte truncation triggers.
    const bigLine = 'x'.repeat(MAX_BYTES + 100)
    const { dir, cleanup } = await tempDir({ 'test.txt': bigLine })
    try {
      const result = await read({ cwd: process.cwd(), path: path.join(dir, 'test.txt') })
      expect(result.truncated).toBe(true)
      expect((result.content[0] as { text: string }).text.length).toBe(MAX_BYTES)
    } finally {
      await cleanup()
    }
  })

  test('truncates when the window exceeds MAX_LINES', async () => {
    const lines = Array.from({ length: MAX_LINES + 50 }, (_, i) => `line${i}`).join('\n')
    const { dir, cleanup } = await tempDir({ 'test.txt': lines })
    try {
      const result = await read({ cwd: process.cwd(), path: path.join(dir, 'test.txt') })
      expect(result.truncated).toBe(true)
      const text = (result.content[0] as { text: string }).text
      expect(text.split('\n')).toHaveLength(MAX_LINES)
    } finally {
      await cleanup()
    }
  })

  test('missing file returns error result with isError', async () => {
    const result = await read({ cwd: process.cwd(), path: '/tmp/nonexistent-file-xyz-123' })
    expect(result.isError).toBe(true)
    expect(result.content[0]!.type).toBe('input_text')
    expect((result.content[0] as { text: string }).text).toContain('Error')
  })

  test('offset beyond file length returns error with isError', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'hello' })
    try {
      const result = await read({
        cwd: process.cwd(),
        path: path.join(dir, 'test.txt'),
        offset: 10,
      })
      expect(result.isError).toBe(true)
      expect((result.content[0] as { text: string }).text).toContain('Error')
    } finally {
      await cleanup()
    }
  })

  test('directory path returns isError', async () => {
    const result = await read({ cwd: process.cwd(), path: process.cwd() })
    expect(result.isError).toBe(true)
    expect((result.content[0] as { text: string }).text).toContain('directory')
  })

  test('octet-stream file falls through to the text branch', async () => {
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'small.bin')
    const smallBytes = new Uint8Array(128)
    smallBytes.fill(0x42)
    await Bun.write(filePath, smallBytes)
    try {
      const result = await read({ path: filePath, cwd: process.cwd() })
      expect(result.isError).toBeUndefined()
      expect(result.content).toHaveLength(1)
      expect(result.content[0]!.type).toBe('input_text')
      expect((result.content[0] as { text: string }).text).toBe(Buffer.from(smallBytes).toString())
    } finally {
      await cleanup()
    }
  })
})

describe('read tool — provisioned cwd', () => {
  test('relative path resolves against the composed cwd', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'scoped content' })
    try {
      const result = await read({ cwd: dir, path: 'test.txt' })
      expect((result.content[0] as { text: string }).text).toBe('scoped content')
    } finally {
      await cleanup()
    }
  })
})

// ================================================================
// read tool — binary branch (image / audio / video)
// ================================================================

describe('read tool — image branch', () => {
  test('reads a real JPEG file: text note + image part with dimensions', async () => {
    const fixturePath = path.join(import.meta.dir, 'fixtures', '1x1.jpg')
    const jpegBytes = await Bun.file(fixturePath).bytes()

    const result = await read({ path: fixturePath, cwd: process.cwd() })

    expect(result.isError).toBeUndefined()
    expect(result.content).toHaveLength(2)

    const note = result.content[0]!
    expect(note.type).toBe('input_text')
    expect((note as { text: string }).text).toBe('Read image file [image/jpeg] 1x1')

    const imagePart = result.content[1]!
    expect(imagePart.type).toBe('image')
    const url = (imagePart as { image_url: { url: string } }).image_url.url
    expect(url).toBe(`data:image/jpeg;base64,${Buffer.from(jpegBytes).toString('base64')}`)
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
      const result = await read({ path: filePath, cwd: process.cwd() })

      expect(result.isError).toBeUndefined()
      expect(result.content).toHaveLength(2)

      const note = result.content[0]!
      expect(note.type).toBe('input_text')
      expect((note as { text: string }).text).toBe('Read image file [image/png] 1x1')

      const imagePart = result.content[1]!
      expect(imagePart.type).toBe('image')
      const url = (imagePart as { image_url: { url: string } }).image_url.url
      expect(url).toBe(`data:image/png;base64,${Buffer.from(pngBytes).toString('base64')}`)
    } finally {
      await cleanup()
    }
  })
})

describe('read tool — audio branch', () => {
  test('reads an MP3 (ID3v2) file: text note + audio part with format', async () => {
    const mp3Bytes = new Uint8Array([0x49, 0x44, 0x33, 0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'clip.mp3')
    await Bun.write(filePath, mp3Bytes)

    try {
      const result = await read({ path: filePath, cwd: process.cwd() })

      expect(result.isError).toBeUndefined()
      expect(result.content).toHaveLength(2)

      const note = result.content[0]!
      expect(note.type).toBe('input_text')
      expect((note as { text: string }).text).toBe('Read audio file [audio/mpeg]')

      const audioPart = result.content[1]!
      expect(audioPart.type).toBe('audio')
      const data = (audioPart as { data: string; format?: string }).data
      expect(data).toBe(Buffer.from(mp3Bytes).toString('base64'))
      expect((audioPart as { data: string; format?: string }).format).toBe('mp3')
    } finally {
      await cleanup()
    }
  })
})

describe('read tool — video branch', () => {
  test('reads an MP4 (ftyp) file: text note + video part with format', async () => {
    const mp4Bytes = new Uint8Array(16)
    mp4Bytes[0] = 0x00
    mp4Bytes[1] = 0x00
    mp4Bytes[2] = 0x00
    mp4Bytes[3] = 0x18 // box length = 24
    mp4Bytes[4] = 0x66 // f
    mp4Bytes[5] = 0x74 // t
    mp4Bytes[6] = 0x79 // y
    mp4Bytes[7] = 0x70 // p
    mp4Bytes[8] = 0x69 // i
    mp4Bytes[9] = 0x73
    mp4Bytes[10] = 0x6f
    mp4Bytes[11] = 0x6d
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'clip.mp4')
    await Bun.write(filePath, mp4Bytes)

    try {
      const result = await read({ path: filePath, cwd: process.cwd() })

      expect(result.isError).toBeUndefined()
      expect(result.content).toHaveLength(2)

      const note = result.content[0]!
      expect(note.type).toBe('input_text')
      expect((note as { text: string }).text).toBe('Read video file [video/mp4]')

      const videoPart = result.content[1]!
      expect(videoPart.type).toBe('video')
      const data = (videoPart as { data: string; format?: string }).data
      expect(data).toBe(Buffer.from(mp4Bytes).toString('base64'))
      expect((videoPart as { data: string; format?: string }).format).toBe('mp4')
    } finally {
      await cleanup()
    }
  })
})

// ================================================================
// read tool — binary ceiling + error paths
// ================================================================

describe('read tool — binary ceiling', () => {
  test('file over default ceiling returns isError', async () => {
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'large.jpg')
    // A real JPEG header so detection routes to the image branch.
    const header = new Uint8Array([0xff, 0xd8, 0xff, 0xe0])
    const largeBytes = new Uint8Array(DEFAULT_MAX_BINARY_BYTES + 1)
    largeBytes.set(header)
    largeBytes.fill(0x00, header.length)
    await Bun.write(filePath, largeBytes)

    try {
      const result = await read({ path: filePath, cwd: process.cwd() })
      expect(result.isError).toBe(true)
      expect(result.content).toHaveLength(1)
      expect(result.content[0]!.type).toBe('input_text')
      expect((result.content[0] as { text: string }).text).toContain(String(DEFAULT_MAX_BINARY_BYTES))
    } finally {
      await cleanup()
    }
  })

  test('provision-time maxBytes overrides the ceiling downward', async () => {
    const fixturePath = path.join(import.meta.dir, 'fixtures', '1x1.jpg')
    const jpegBytes = await Bun.file(fixturePath).bytes()
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'test.jpg')
    await Bun.write(filePath, jpegBytes)

    try {
      const result = await read({ path: filePath, cwd: process.cwd(), maxBytes: jpegBytes.length - 1 })
      expect(result.isError).toBe(true)
      expect(result.content).toHaveLength(1)
      expect((result.content[0] as { text: string }).text).toContain('exceeds maximum size')
    } finally {
      await cleanup()
    }
  })

  test('provision-time maxBytes allows files under the limit', async () => {
    const fixturePath = path.join(import.meta.dir, 'fixtures', '1x1.jpg')
    const jpegBytes = await Bun.file(fixturePath).bytes()
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'test.jpg')
    await Bun.write(filePath, jpegBytes)

    try {
      const result = await read({ path: filePath, cwd: process.cwd(), maxBytes: jpegBytes.length + 1000 })
      expect(result.isError).toBeUndefined()
      expect(result.content).toHaveLength(2)
      expect(result.content[1]!.type).toBe('image')
    } finally {
      await cleanup()
    }
  })

  test('rejects empty string path with isError (resolves to cwd, a directory)', async () => {
    const result = await read({ path: '', cwd: process.cwd() })
    expect(result.isError).toBe(true)
  })
})
