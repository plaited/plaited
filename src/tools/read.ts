import { stat } from 'node:fs/promises'
import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { type InputContentPart, InputContentPartSchema } from './open-responses.schemas.ts'
import { formatSize, DEFAULT_MAX_BYTES as MAX_BYTES, type TruncationResult, truncateHead } from './truncate.ts'
import { useTool } from './use-tool.ts'

// ----------------------------------------------------------------
// Constants
// ----------------------------------------------------------------

// MAX_LINES / MAX_BYTES are re-exported from truncate.ts (single source of
// truth) so existing import sites keep working.
export { DEFAULT_MAX_BYTES as MAX_BYTES, DEFAULT_MAX_LINES as MAX_LINES } from './truncate.ts'

/**
 * Default ceiling for the binary (image/audio/video) branch (20 MB).
 * Distinct from the text line/byte ceiling — provisioners may override via
 * the optional `maxBytes` input.
 *
 * MINIMAL: single constant. Upgrade path: read from adapter capabilities
 * record in Phase 7.
 */
export const DEFAULT_MAX_BINARY_BYTES = 20 * 1024 * 1024

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
// Format mapping helpers
// ----------------------------------------------------------------

/**
 * Map a detected MIME type to the corresponding input-content-part type
 * discriminator for the Open Responses schema. Returns `undefined` for
 * non-media MIME types — those take the text branch.
 *
 * Load-bearing: the handler uses this to decide which content-part variant
 * to build.
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
export const mimeTypeToAudioFormat = (mimeType: string): 'mp3' | 'wav' | 'ogg' | 'flac' | 'aac' | undefined => {
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
export const mimeTypeToVideoFormat = (mimeType: string): 'mp4' | 'webm' | 'avi' | 'mov' | 'quicktime' | undefined => {
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
// Content-part construction helper
// ----------------------------------------------------------------

/**
 * Build a single `input_text` content-part. Gives the literal the contextual
 * `InputContentPart` type so array literals stay assignable to `Output['content']`
 * without `as` casts (TS would otherwise widen `type` to `string`).
 */
const textPart = (text: string): InputContentPart => ({ type: 'input_text', text })

// ----------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------

type Input = {
  cwd: string
  path: string
  offset?: number
  limit?: number
  maxBytes?: number
}

export const ReadInputSchema: JSONSchemaType<Input> = {
  type: 'object',
  properties: {
    cwd: { type: 'string', minLength: 1, description: "the tool's provisioned cwd" },
    path: { type: 'string', description: "file path — absolute, or relative to the tool's provisioned cwd" },
    offset: { type: 'integer', nullable: true, description: '1-indexed line to start reading from (text branch)' },
    limit: { type: 'integer', nullable: true, description: 'maximum number of lines to read (text branch)' },
    maxBytes: {
      type: 'number',
      nullable: true,
      description:
        'ceiling for the binary (image/audio/video) branch — over the limit returns isError. ' +
        `Defaults to ${DEFAULT_MAX_BINARY_BYTES} bytes. Does not affect the text branch.`,
    },
  },
  required: ['path', 'cwd'],
  additionalProperties: false,
}

type Output = {
  content: InputContentPart[]
  truncated?: boolean
  truncation?: TruncationResult
  message?: string
  isError?: boolean
}

// InputContentPart lives once in the responses schema module (AJV). Its
// raw JSON Schema is exposed via `InputContentPartSchema.schema` so the read
// tool's outputSchema stays in sync with it automatically — no
// hand-maintained oneOf. Runtime validation is still AJV (ajv.compile in
// use-tool). The sub-schema is cast through `unknown` because
// JSONSchemaType<Output> cannot statically verify a discriminated oneOf;
// AJV validates the shape at runtime.
const inputContentPartJsonSchema = InputContentPartSchema.schema

// TruncationResult has a nullable-enum field (truncatedBy: 'lines' | 'bytes'
// | null) that JSONSchemaType cannot statically verify. Define the schema as a
// separate const and cast through `unknown` — same pattern as
// inputContentPartJsonSchema above. AJV validates the shape at runtime.
const truncationResultJsonSchema = {
  type: 'object' as const,
  nullable: true,
  properties: {
    content: { type: 'string' as const },
    truncated: { type: 'boolean' as const },
    truncatedBy: { type: 'string' as const, enum: ['lines', 'bytes'], nullable: true },
    totalLines: { type: 'integer' as const },
    totalBytes: { type: 'integer' as const },
    outputLines: { type: 'integer' as const },
    outputBytes: { type: 'integer' as const },
    lastLinePartial: { type: 'boolean' as const },
    firstLineExceedsLimit: { type: 'boolean' as const },
    maxLines: { type: 'integer' as const },
    maxBytes: { type: 'integer' as const },
  },
  required: [
    'content',
    'truncated',
    'truncatedBy',
    'totalLines',
    'totalBytes',
    'outputLines',
    'outputBytes',
    'lastLinePartial',
    'firstLineExceedsLimit',
    'maxLines',
    'maxBytes',
  ],
  additionalProperties: false,
  description: 'full TruncationResult from truncateHead — present when truncation occurred',
}

// The full ReadOutputSchema is cast through `unknown` because
// TruncationResult.truncatedBy ('lines' | 'bytes' | null) is a nullable enum
// that JSONSchemaType cannot statically verify — same limitation as the
// Zod-derived inputContentPartJsonSchema above. AJV validates at runtime.
export const ReadOutputSchema = {
  type: 'object',
  properties: {
    content: {
      type: 'array',
      items: inputContentPartJsonSchema as unknown as JSONSchemaType<InputContentPart>,
    },
    truncated: { type: 'boolean', nullable: true },
    truncation: truncationResultJsonSchema,
    message: { type: 'string', nullable: true, description: 'error/detail note' },
    isError: { type: 'boolean', nullable: true, description: 'true when the operation failed' },
  },
  required: ['content'],
  additionalProperties: false,
} as unknown as JSONSchemaType<Output>

// ----------------------------------------------------------------
// Run function
// ----------------------------------------------------------------

/**
 * Read a file — unified text/binary by detection, not a mode flag.
 *
 * Reads bytes once, detects MIME type from magic bytes, then branches:
 * - image/audio/video → a text note content-part alongside the media part
 *   (base64 data URI / inline data). Image dimensions via `Bun.Image.metadata()`
 *   (bytes input, never path), surfaced in the note; graceful absence on
 *   exotic formats.
 * - everything else → text branch with offset/limit line windowing and the
 *   MAX_LINES / MAX_BYTES truncation ceiling.
 *
 * `cwd` is a required input field — provided by the provisioner. Paths resolve
 * against the provisioned cwd (absolute paths win). Errors (file-not-found,
 * directory, unreadable, over-ceiling, offset-out-of-bounds) return a single
 * `input_text` content-part with the error message and `isError: true` —
 * matching the success shape.
 */

export const READ_TOOL_NAME = 'read'
export const read = useTool(
  {
    name: READ_TOOL_NAME,
    description:
      'Read the contents of a file — text or binary (image/audio/video), ' +
      'auto-detected from magic bytes. Text output is truncated to 2000 lines ' +
      'or 50KB (whichever is hit first); use offset/limit for large files. ' +
      'Binary output is returned as content-parts (a text note + the media part). ' +
      'Files over the binary size ceiling return an error — never a corrupt blob.',
    inputSchema: ReadInputSchema,
    outputSchema: ReadOutputSchema,
  },
  async ({ path: filePath, cwd, offset, limit, maxBytes }, _validate) => {
    const resolved = path.resolve(cwd, filePath)

    // Directory/existence check via stat (node:fs — no Bun equivalent for dirs;
    // Bun.file.exists() returns false for directories). Avoids spawning a
    // subprocess for what is a stat call.
    const stats = await stat(resolved).catch(() => undefined)
    if (!stats) {
      return {
        content: [textPart(`[Error: file not found: ${resolved}]`)],
        isError: true,
      }
    }
    if (stats.isDirectory()) {
      return {
        content: [textPart(`[Error: path is a directory: ${resolved}]`)],
        isError: true,
      }
    }

    let bytes: Uint8Array
    try {
      bytes = await Bun.file(resolved).bytes()
    } catch {
      return {
        content: [textPart(`[Error: could not read file: ${resolved}]`)],
        isError: true,
      }
    }

    const mimeType = detectMimeType(bytes)
    const partType = mimeTypeToContentPartType(mimeType)

    // --- Binary branch: image / audio / video ---
    if (partType) {
      const ceiling = maxBytes ?? DEFAULT_MAX_BINARY_BYTES
      if (bytes.length > ceiling) {
        return {
          content: [textPart(`[Error: file exceeds maximum size: ${bytes.length} bytes > ${ceiling} limit]`)],
          isError: true,
        }
      }

      const base64 = Buffer.from(bytes).toString('base64')
      const content: InputContentPart[] = []

      if (partType === 'image') {
        let note = `Read image file [${mimeType}]`
        try {
          const metadata = await new Bun.Image(bytes).metadata()
          if (metadata.width !== undefined && metadata.height !== undefined) {
            note = `Read image file [${mimeType}] ${metadata.width}x${metadata.height}`
          }
        } catch (err) {
          // fixed: was reporting size-ceiling error for metadata failures
          note = `Read image file [${mimeType}] (dimensions unavailable: ${(err as Error).message})`
        }
        content.push({ type: 'input_text', text: note })
        content.push({ type: 'image', image_url: { url: `data:${mimeType};base64,${base64}` } })
      } else if (partType === 'audio') {
        content.push({ type: 'input_text', text: `Read audio file [${mimeType}]` })
        const format = mimeTypeToAudioFormat(mimeType)
        content.push(format ? { type: 'audio', data: base64, format } : { type: 'audio', data: base64 })
      } else {
        // video
        content.push({ type: 'input_text', text: `Read video file [${mimeType}]` })
        const format = mimeTypeToVideoFormat(mimeType)
        content.push(format ? { type: 'video', data: base64, format } : { type: 'video', data: base64 })
      }

      return { content }
    }

    // --- Text branch: application/octet-stream or text MIME ---
    let text: string
    try {
      text = new TextDecoder('utf-8').decode(bytes)
    } catch {
      return {
        content: [textPart(`[Error: could not read file: ${resolved}]`)],
        isError: true,
      }
    }

    const allLines = text.split('\n')
    const totalFileLines = allLines.length

    // Apply offset (1-indexed) — convert to 0-indexed array access.
    const startLine = typeof offset === 'number' && offset > 0 ? offset - 1 : 0
    const startLineDisplay = startLine + 1
    if (startLine >= totalFileLines) {
      return {
        content: [textPart(`[Error: offset ${offset} is beyond end of file (${totalFileLines} lines total)]`)],
        isError: true,
      }
    }

    // If a user limit is specified, honor it first; otherwise truncateHead
    // decides against the MAX_LINES / MAX_BYTES ceiling.
    let selectedContent: string
    let userLimitedLines: number | undefined
    if (typeof limit === 'number') {
      const endLine = Math.min(startLine + limit, totalFileLines)
      selectedContent = allLines.slice(startLine, endLine).join('\n')
      userLimitedLines = endLine - startLine
    } else {
      selectedContent = allLines.slice(startLine).join('\n')
    }

    // Byte-accurate, UTF-8-safe truncation — never .slice() by code units.
    const truncation = truncateHead(selectedContent)
    let outputText: string

    if (truncation.firstLineExceedsLimit) {
      // First line alone exceeds the byte limit — point the model at a bash fallback.
      const firstLineSize = formatSize(Buffer.byteLength(allLines[startLine] ?? '', 'utf-8'))
      outputText = `[Line ${startLineDisplay} is ${firstLineSize}, exceeds ${formatSize(MAX_BYTES)} limit. Use bash: sed -n '${startLineDisplay}p' ${filePath} | head -c ${MAX_BYTES}]`
    } else if (truncation.truncated) {
      // Truncation occurred — build an actionable continuation notice.
      const endLineDisplay = startLineDisplay + truncation.outputLines - 1
      const nextOffset = endLineDisplay + 1
      outputText = truncation.content
      if (truncation.truncatedBy === 'lines') {
        outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines}. Use offset=${nextOffset} to continue.]`
      } else {
        outputText += `\n\n[Showing lines ${startLineDisplay}-${endLineDisplay} of ${totalFileLines} (${formatSize(MAX_BYTES)} limit). Use offset=${nextOffset} to continue.]`
      }
    } else if (userLimitedLines !== undefined && startLine + userLimitedLines < totalFileLines) {
      // User-specified limit stopped early, but the file still has more content.
      const remaining = totalFileLines - (startLine + userLimitedLines)
      const nextOffset = startLine + userLimitedLines + 1
      outputText = `${truncation.content}\n\n[${remaining} more lines in file. Use offset=${nextOffset} to continue.]`
    } else {
      outputText = truncation.content
    }

    const result: Output = {
      content: [textPart(outputText)],
      truncated: truncation.truncated || truncation.firstLineExceedsLimit,
    }
    // Pass the full TruncationResult straight through — no re-computation drift.
    if (result.truncated) {
      result.truncation = truncation
    }
    return result
  },
)
