import { stat } from 'node:fs/promises'
import * as path from 'node:path'
import * as z from 'zod'
import { useMCPServer } from './use-mcp-server.ts'
// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

/**
 * Default ceiling for binary file read (20 MB).
 * The active adapter's declared capabilities should supply this at provision time;
 * when none is declared, this conservative default applies.
 *
 * MINIMAL: single constant. Upgrade path: read from adapter capabilities record
 * in Phase 7.
 */
export const DEFAULT_MAX_BINARY_BYTES = 20 * 1024 * 1024

// ----------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------

export const outputSchema = {
  type: 'object',
  properties: {
    mimeType: { type: 'string', description: 'detected MIME type, e.g. "image/jpeg", "audio/mpeg", "video/mp4"' },
    base64: { type: 'string', description: 'base64-encoded file content — data-URI ready' },
    width: { type: 'integer', description: 'image width — present when image MIME and Bun.Image.metadata() succeeds' },
    height: { type: 'integer', description: 'image height in pixels, same conditions as width' },
    imageFormat: {
      type: 'string',
      description: "Bun.Image's own format sniff (jpeg/png/webp...) — corroborates magic bytes when present",
    },
    bytesRead: { type: 'integer', description: 'actual bytes encoded' },
    message: {
      type: 'string',
      description: 'error detail when isError — states what failed and, for size ceilings, the limit',
    },
    isError: { type: 'boolean' },
  },
  required: ['mimeType', 'base64', 'bytesRead'],
  additionalProperties: false,
}

/**
 * Provision-time extension for the binary tool.
 * `maxBytes` caps the binary read size — over the ceiling returns isError.
 */
export type BinaryProvision = {
  /** Maximum bytes to read. Overrides DEFAULT_MAX_BINARY_BYTES. */
  maxBytes?: number
}

// ----------------------------------------------------------------
// Magic-byte detection (offset-aware)
// ----------------------------------------------------------------

/**
 * Detect MIME type from magic bytes.
 *
 * Uses the first 12+ bytes of a binary blob to identify known formats.
 * Container formats (RIFF, MP4/ftyp) check the format tag at offset 8/4
 * rather than bare prefix matching — a bare prefix match is wrong for all
 * three RIFF/ftyp families.
 *
 * Returns `application/octet-stream` when no known signature matches.
 */
export const detectMimeType = (bytes: Uint8Array): string => {
  if (bytes.length < 2) return 'application/octet-stream'

  // --- Video: MP4 ftyp box ---
  // A box with 'ftyp' at offset 4; box length at offset 0 (typically 0x18, 0x1c, 0x20)
  if (
    bytes.length >= 12 &&
    bytes[4] !== undefined &&
    bytes[4] === 0x66 && // f
    bytes[5] !== undefined &&
    bytes[5] === 0x74 && // t
    bytes[6] !== undefined &&
    bytes[6] === 0x79 && // y
    bytes[7] !== undefined &&
    bytes[7] === 0x70 // p
  ) {
    const b0 = bytes[0]!
    const b1 = bytes[1]!
    const b2 = bytes[2]!
    const b3 = bytes[3]!
    const boxLength = (b0 << 24) | (b1 << 16) | (b2 << 8) | b3
    // ftyp box length varies — accept any reasonable length >= 8
    if (boxLength >= 8) {
      // Check for QuickTime brand (qt  ) at offset 8
      const b8 = bytes[8]!
      const b9 = bytes[9]!
      const b10 = bytes[10]!
      if (b8 === 0x71 && b9 === 0x74 && b10 === 0x20) {
        return 'video/quicktime'
      }
      return 'video/mp4'
    }
  }

  // --- Image: JPEG ---
  // JPEG SOI marker: ff d8 ff
  if (bytes.length >= 3) {
    const b0 = bytes[0]!
    const b1 = bytes[1]!
    const b2 = bytes[2]!
    if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff) {
      return 'image/jpeg'
    }
  }

  // --- Image: PNG ---
  if (bytes.length >= 8) {
    const b0 = bytes[0]!
    const b1 = bytes[1]!
    const b2 = bytes[2]!
    const b3 = bytes[3]!
    const b4 = bytes[4]!
    const b5 = bytes[5]!
    const b6 = bytes[6]!
    const b7 = bytes[7]!
    if (
      b0 === 0x89 &&
      b1 === 0x50 &&
      b2 === 0x4e &&
      b3 === 0x47 &&
      b4 === 0x0d &&
      b5 === 0x0a &&
      b6 === 0x1a &&
      b7 === 0x0a
    ) {
      return 'image/png'
    }
  }

  // --- Image: GIF ---
  if (bytes.length >= 6) {
    const b0 = bytes[0]!
    const b1 = bytes[1]!
    const b2 = bytes[2]!
    if (b0 === 0x47 && b1 === 0x49 && b2 === 0x46) {
      return 'image/gif'
    }
  }

  // --- Image: BMP ---
  // BMP starts with "BM" (0x42, 0x4d). Plain text can start with "BM" too,
  // so we require a minimum file size encoded in bytes 2-5 that is ≥ 14 bytes
  // (the BMP header minimum). This excludes trivial "BM" prefix in text.
  if (bytes.length >= 6) {
    const b0 = bytes[0]!
    const b1 = bytes[1]!
    if (b0 === 0x42 && b1 === 0x4d) {
      const b2 = bytes[2]!
      const b3 = bytes[3]!
      const b4 = bytes[4]!
      const b5 = bytes[5]!
      const fileSize = (b5 << 24) | (b4 << 16) | (b3 << 8) | b2
      // Reject if size is unrealistically small (plain text "BM" or BMP < 14 byte header)
      if (fileSize >= 14) {
        return 'image/bmp'
      }
    }
  }

  // --- RIFF container: discriminate between WAV, AVI, WebP ---
  if (bytes.length >= 12) {
    const b0 = bytes[0]!
    const b1 = bytes[1]!
    const b2 = bytes[2]!
    const b3 = bytes[3]!
    const b8 = bytes[8]!
    const b9 = bytes[9]!
    const b10 = bytes[10]!
    const b11 = bytes[11]!
    if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46) {
      if (b8 === 0x57 && b9 === 0x45 && b10 === 0x42 && b11 === 0x50) {
        return 'image/webp'
      }
      if (b8 === 0x57 && b9 === 0x41 && b10 === 0x56 && b11 === 0x45) {
        return 'audio/wav'
      }
      if (b8 === 0x41 && b9 === 0x56 && b10 === 0x49 && b11 === 0x20) {
        return 'video/avi'
      }
    }
  }

  // --- Audio: AAC ADTS ---
  // ADTS: syncword 0xFFF + layer = 00 (bits 1-2 clear).
  // Check AAC before MP3 because 0xFF F1–F7 could match either —
  // layer bits 0x06 disambiguate: AAC has layer=00, MP3 has layer=01+.
  if (bytes.length >= 2) {
    const b0 = bytes[0]!
    const b1 = bytes[1]!
    if (b0 === 0xff && (b1 & 0xf6) === 0xf0) {
      return 'audio/aac'
    }
  }

  // --- Audio: MP3 ---
  // ID3v2 tag: "ID3" at offset 0
  if (bytes.length >= 3) {
    const b0 = bytes[0]!
    const b1 = bytes[1]!
    const b2 = bytes[2]!
    if (b0 === 0x49 && b1 === 0x44 && b2 === 0x33) {
      return 'audio/mpeg'
    }
  }
  // MP3 sync frame: ff fb (or ff f2, ff f3, ff fa etc.)
  if (bytes.length >= 2) {
    const b0 = bytes[0]!
    const b1 = bytes[1]!
    if (b0 === 0xff && (b1 & 0xf0) === 0xf0) {
      return 'audio/mpeg'
    }
  }

  // --- Audio: OGG ---
  if (bytes.length >= 4) {
    const b0 = bytes[0]!
    const b1 = bytes[1]!
    const b2 = bytes[2]!
    const b3 = bytes[3]!
    if (b0 === 0x4f && b1 === 0x67 && b2 === 0x67 && b3 === 0x53) {
      return 'audio/ogg'
    }
  }

  // --- Audio: FLAC ---
  if (bytes.length >= 4) {
    const b0 = bytes[0]!
    const b1 = bytes[1]!
    const b2 = bytes[2]!
    const b3 = bytes[3]!
    if (b0 === 0x66 && b1 === 0x4c && b2 === 0x61 && b3 === 0x43) {
      return 'audio/flac'
    }
  }

  // --- Video: WebM (and MKV) ---
  if (bytes.length >= 4) {
    const b0 = bytes[0]!
    const b1 = bytes[1]!
    const b2 = bytes[2]!
    const b3 = bytes[3]!
    if (b0 === 0x1a && b1 === 0x45 && b2 === 0xdf && b3 === 0xa3) {
      return 'video/webm'
    }
  }

  // Fallback
  return 'application/octet-stream'
}

// ----------------------------------------------------------------
// Format mapping helpers (for handler-side content part construction)
// ----------------------------------------------------------------

/**
 * Map a detected MIME type to the corresponding input-content-part type
 * discriminator for the Open Responses schema.
 *
 * Handlers converting `binary_result` into the next `respond` request
 * use this to construct the correct content part.
 */
export const mimeTypeToContentPartType = (mimeType: string): 'image' | 'audio' | 'video' | undefined => {
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType.startsWith('audio/')) return 'audio'
  if (mimeType.startsWith('video/')) return 'video'
  return undefined
}

/**
 * Map a detected MIME type to the audio format enum value.
 */
export const mimeTypeToAudioFormat = (mimeType: string): string | undefined => {
  switch (mimeType) {
    case 'audio/mpeg':
      return 'mp3'
    case 'audio/wav':
      return 'wav'
    case 'audio/ogg':
      return 'ogg'
    case 'audio/flac':
      return 'flac'
    case 'audio/aac':
      return 'aac'
    default:
      return undefined
  }
}

/**
 * Map a detected MIME type to the video format enum value.
 */
export const mimeTypeToVideoFormat = (mimeType: string): string | undefined => {
  switch (mimeType) {
    case 'video/mp4':
      return 'mp4'
    case 'video/webm':
      return 'webm'
    case 'video/avi':
      return 'avi'
    case 'video/quicktime':
      return 'quicktime'
    default:
      return undefined
  }
}

// ----------------------------------------------------------------
// Run function
// ----------------------------------------------------------------

/**
 * Read a binary file, detect its MIME type from magic bytes, encode as base64.
 *
 * Registered via `useMCPServer` as the `binary` MCP tool. `cwd` is a required
 * input field — always provided by the provisioner. Paths resolve against the
 * provisioned cwd (absolute paths win). Files larger than the ceiling (default
 * or provision-time `maxBytes`) return `isError: true` with a descriptive
 * message — never a partial/corrupt blob.
 *
 * Image files trigger `Bun.Image.metadata()` (passing bytes, never path) to
 * extract dimensions without decoding pixel data. Dimensions are absent gracefully
 * on exotic/undecodable formats — no crash path.
 */

export const BINARY_TOOL_NAME = 'binary'
export const binary = useMCPServer((server) => {
  server.registerTool(
    BINARY_TOOL_NAME,
    {
      description:
        'Read a binary file (image, audio, video) — detects MIME type from magic bytes, ' +
        'encodes as base64 for multi-modal model consumption. Returns image dimensions via ' +
        'Bun.Image.metadata() when applicable. Files over the size ceiling return an error ' +
        '— never a corrupt partial blob.',
      inputSchema: z.object({
        cwd: z.string().describe("the tool's provisioned cwd"),
        path: z.string().describe("file path — absolute, or relative to the tool's provisioned cwd"),
        maxBytes: z.number().optional().describe('This caps the binary read size — over the ceiling returns isError.'),
      }),
      outputSchema: z.object({
        mimeType: z.string().describe('detected MIME type, e.g. "image/jpeg", "audio/mpeg", "video/mp4"'),
        base64: z.string().describe('base64-encoded file content — data-URI ready'),
        bytesRead: z.number().int().describe('actual bytes encoded'),
        width: z
          .number()
          .int()
          .optional()
          .describe('image width — present when image MIME and Bun.Image.metadata() succeeds'),
        height: z.number().int().optional().describe('image height in pixels, same conditions as width'),
        imageFormat: z
          .string()
          .optional()
          .describe("Bun.Image's own format sniff (jpeg/png/webp...) — corroborates magic bytes when present"),
        message: z
          .string()
          .optional()
          .describe('error detail when isError — states what failed and, for size ceilings, the limit'),
        isError: z.boolean().optional().describe('true when the operation failed — the message field explains why'),
      }),
    },
    async ({ path: filePath, cwd, maxBytes }) => {
      const resolved = path.resolve(cwd, filePath)

      // Directory/existence check via stat (node:fs — no Bun equivalent for dirs;
      // Bun.file.exists() returns false for directories). Avoids spawning a
      // subprocess for what is a stat call.
      const stats = await stat(resolved).catch(() => undefined)
      if (!stats) {
        const output = {
          mimeType: 'application/octet-stream',
          base64: '',
          bytesRead: 0,
          message: `[Error: file not found: ${resolved}]`,
          isError: true,
        }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }
      if (stats.isDirectory()) {
        const output = {
          mimeType: 'application/octet-stream',
          base64: '',
          bytesRead: 0,
          message: `[Error: path is a directory: ${resolved}]`,
          isError: true,
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }

      // Read file bytes
      const bunFile = Bun.file(resolved)
      let bytes: Uint8Array
      try {
        bytes = await bunFile.bytes()
      } catch {
        const output = {
          mimeType: 'application/octet-stream',
          base64: '',
          bytesRead: 0,
          message: `[Error: could not read file: ${resolved}]`,
          isError: true,
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }

      // Size ceiling check (provision-time maxBytes or default) — the error names
      // the limit so the model can self-correct (Phase 7 declared capabilities)
      const ceiling = maxBytes ?? DEFAULT_MAX_BINARY_BYTES
      if (bytes.length > ceiling) {
        const output = {
          mimeType: 'application/octet-stream',
          base64: '',
          bytesRead: 0,
          message: `[Error: file exceeds maximum size: ${bytes.length} bytes > ${ceiling} limit]`,
          isError: true,
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }

      const mimeType = detectMimeType(bytes)
      const base64 = Buffer.from(bytes).toString('base64')
      const bytesRead = bytes.length

      // Image dimensions via Bun.Image.metadata() (bytes input only)
      let width: number | undefined
      let height: number | undefined
      let imageFormat: string | undefined

      if (mimeType.startsWith('image/')) {
        try {
          const image = new Bun.Image(bytes)
          const metadata = await image.metadata()
          if (metadata.width !== undefined) width = metadata.width
          if (metadata.height !== undefined) height = metadata.height
          if (metadata.format !== undefined) imageFormat = metadata.format
        } catch {
          const output = {
            mimeType,
            base64,
            bytesRead,
            message: `[Error: file exceeds maximum size: ${bytes.length} bytes > ${ceiling} limit]`,
            isError: true,
          }
          return {
            content: [{ type: 'text', text: JSON.stringify(output) }],
            structuredContent: output,
          }
        }
      }
      const output = {
        mimeType,
        base64,
        width,
        height,
        imageFormat,
        bytesRead,
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(output) }],
        structuredContent: output,
      }
    },
  )
})
