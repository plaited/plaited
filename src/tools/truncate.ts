import * as z from 'zod'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_MAX_LINES = 2000
const DEFAULT_MAX_BYTES = 50 * 1024 // 50KB

// ============================================================================
// Schema
// ============================================================================

/**
 * Metadata returned alongside truncated content.
 *
 * @remarks
 * `truncated` is true when either the line or byte cap was hit.
 * Consumers should surface `totalLines` / `totalBytes` so the caller
 * knows how much was omitted.
 *
 * @public
 */
export const TruncationResultSchema = z.object({
  content: z.string(),
  truncated: z.boolean(),
  totalLines: z.number(),
  totalBytes: z.number(),
  outputLines: z.number(),
})

export type TruncationResult = z.infer<typeof TruncationResultSchema>

export type TruncateOptions = {
  maxLines?: number
  maxBytes?: number
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Count total newlines in a buffer using Bun's SIMD-optimized scanner.
 *
 * @remarks
 * `Bun.indexOfLine(buf, offset)` returns the byte offset of the next
 * `\n` from `offset`, or -1 when none remain. We walk the buffer
 * without ever splitting the string into an array.
 */
const countLines = (buf: Buffer): number => {
  let count = 1 // at least one line even without a trailing newline
  let offset = 0
  while (true) {
    const idx = Bun.indexOfLine(buf, offset)
    if (idx === -1) break
    count++
    offset = idx + 1
  }
  return count
}

/**
 * Find the byte offset just past the Nth newline (0-indexed line count).
 * Returns -1 if fewer than `n` newlines exist.
 */
const nthNewlineOffset = (buf: Buffer, n: number): number => {
  let offset = 0
  for (let i = 0; i < n; i++) {
    const idx = Bun.indexOfLine(buf, offset)
    if (idx === -1) return -1
    offset = idx + 1
  }
  return offset
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Keep the first N lines of text, capped by line count and byte size.
 *
 * @remarks
 * Used by `readFile` to prevent large files from flooding context.
 * Applies the tighter of `maxLines` and `maxBytes` — whichever
 * limit is hit first wins.
 *
 * Uses `Bun.indexOfLine` for SIMD-optimized newline scanning rather
 * than `String.split('\n')`, avoiding a full-content array allocation.
 *
 * @public
 */
export const truncateHead = (text: string, opts: TruncateOptions = {}): TruncationResult => {
  const maxLines = opts.maxLines ?? DEFAULT_MAX_LINES
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const totalBytes = Buffer.byteLength(text)
  const buf = Buffer.from(text)
  const totalLines = countLines(buf)

  // Fast path: fits within both limits
  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    return { content: text, truncated: false, totalLines, totalBytes, outputLines: totalLines }
  }

  // Find the byte offset after maxLines newlines
  let endOffset = totalBytes
  if (totalLines > maxLines) {
    const off = nthNewlineOffset(buf, maxLines)
    if (off !== -1) endOffset = off
  }

  // Apply byte cap (tighter of the two wins)
  if (endOffset > maxBytes) endOffset = maxBytes

  const sliced = buf.subarray(0, endOffset).toString()
  const slicedBuf = Buffer.from(sliced)
  const outputLines = countLines(slicedBuf)

  return { content: sliced, truncated: true, totalLines, totalBytes, outputLines }
}

/**
 * Keep the last N lines of text, capped by line count and byte size.
 *
 * @remarks
 * Used by `bash` to show the tail of command output — the most
 * recent output is usually the most relevant (build errors, test
 * results, etc.).
 *
 * @public
 */
export const truncateTail = (text: string, opts: TruncateOptions = {}): TruncationResult => {
  const maxLines = opts.maxLines ?? DEFAULT_MAX_LINES
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const totalBytes = Buffer.byteLength(text)
  const buf = Buffer.from(text)
  const totalLines = countLines(buf)

  // Fast path: fits within both limits
  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    return { content: text, truncated: false, totalLines, totalBytes, outputLines: totalLines }
  }

  // For tail: we need to skip (totalLines - maxLines) lines from the start
  let startOffset = 0
  if (totalLines > maxLines) {
    const skip = totalLines - maxLines
    const off = nthNewlineOffset(buf, skip)
    if (off !== -1) startOffset = off
  }

  // Apply byte cap from the end
  const availableBytes = totalBytes - startOffset
  if (availableBytes > maxBytes) {
    startOffset = totalBytes - maxBytes
  }

  const sliced = buf.subarray(startOffset).toString()
  const slicedBuf = Buffer.from(sliced)
  const outputLines = countLines(slicedBuf)

  return { content: sliced, truncated: true, totalLines, totalBytes, outputLines }
}
