/**
 * Shared truncation utilities for tool outputs.
 *
 * Truncation is based on two independent limits — whichever is hit first wins:
 * - Line limit (default: 2000 lines)
 * - Byte limit (default: 50KB)
 *
 * Never returns partial lines (except the bash tail truncation edge case, where
 * the last line of original content may be sliced to fit the byte ceiling).
 *
 * Byte-accurate via Buffer.byteLength — never .slice() by UTF-16 code units.
 */

export const DEFAULT_MAX_LINES = 2000
export const DEFAULT_MAX_BYTES = 50 * 1024 // 50KB
export const GREP_MAX_LINE_LENGTH = 500 // Max chars per grep match line

export type TruncationResult = {
  /** The truncated content */
  content: string
  /** Whether truncation occurred */
  truncated: boolean
  /** Which limit was hit: "lines", "bytes", or null if not truncated */
  truncatedBy: 'lines' | 'bytes' | null
  /** Total number of lines in the original content */
  totalLines: number
  /** Total number of bytes in the original content */
  totalBytes: number
  /** Number of complete lines in the truncated output */
  outputLines: number
  /** Number of bytes in the truncated output */
  outputBytes: number
  /** Whether the last line was partially truncated (only for tail truncation edge case) */
  lastLinePartial: boolean
  /** Whether the first line exceeded the byte limit (for head truncation) */
  firstLineExceedsLimit: boolean
  /** The max lines limit that was applied */
  maxLines: number
  /** The max bytes limit that was applied */
  maxBytes: number
}

export type TruncationOptions = {
  /** Maximum number of lines (default: 2000) */
  maxLines?: number
  /** Maximum number of bytes (default: 50KB) */
  maxBytes?: number
}

/**
 * Split content into lines for counting. A trailing newline does not produce a
 * phantom empty line.
 */
const splitLinesForCounting = (content: string): string[] => {
  if (content.length === 0) return []
  const lines = content.split('\n')
  if (content.endsWith('\n')) lines.pop()
  return lines
}

/**
 * Format bytes as human-readable size.
 */
export const formatSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

/**
 * Truncate content from the head (keep first N lines/bytes).
 * Suitable for file reads where you want to see the beginning.
 *
 * Never returns partial lines. If the first line alone exceeds the byte limit,
 * returns empty content with firstLineExceedsLimit=true.
 */
export const truncateHead = (content: string, options: TruncationOptions = {}): TruncationResult => {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES

  const totalBytes = Buffer.byteLength(content, 'utf-8')
  const lines = splitLinesForCounting(content)
  const totalLines = lines.length

  // No truncation needed
  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    return {
      content,
      truncated: false,
      truncatedBy: null,
      totalLines,
      totalBytes,
      outputLines: totalLines,
      outputBytes: totalBytes,
      lastLinePartial: false,
      firstLineExceedsLimit: false,
      maxLines,
      maxBytes,
    }
  }

  // First line alone exceeds the byte limit — point the caller at a fallback.
  const firstLineBytes = Buffer.byteLength(lines[0] ?? '', 'utf-8')
  if (firstLineBytes > maxBytes) {
    return {
      content: '',
      truncated: true,
      truncatedBy: 'bytes',
      totalLines,
      totalBytes,
      outputLines: 0,
      outputBytes: 0,
      lastLinePartial: false,
      firstLineExceedsLimit: true,
      maxLines,
      maxBytes,
    }
  }

  // Collect complete lines that fit
  const outputLinesArr: string[] = []
  let outputBytesCount = 0
  let truncatedBy: 'lines' | 'bytes' = 'lines'

  for (let i = 0; i < lines.length && i < maxLines; i++) {
    const line = lines[i]!
    const lineBytes = Buffer.byteLength(line, 'utf-8') + (i > 0 ? 1 : 0) // +1 for newline

    if (outputBytesCount + lineBytes > maxBytes) {
      truncatedBy = 'bytes'
      break
    }

    outputLinesArr.push(line)
    outputBytesCount += lineBytes
  }

  // Exited due to line limit
  if (outputLinesArr.length >= maxLines && outputBytesCount <= maxBytes) {
    truncatedBy = 'lines'
  }

  const outputContent = outputLinesArr.join('\n')
  const finalOutputBytes = Buffer.byteLength(outputContent, 'utf-8')

  return {
    content: outputContent,
    truncated: true,
    truncatedBy,
    totalLines,
    totalBytes,
    outputLines: outputLinesArr.length,
    outputBytes: finalOutputBytes,
    lastLinePartial: false,
    firstLineExceedsLimit: false,
    maxLines,
    maxBytes,
  }
}

/**
 * Truncate content from the tail (keep last N lines/bytes).
 * Suitable for bash output where you want to see the end (errors, final results).
 *
 * May return a partial first line if the last line of original content exceeds
 * the byte limit — matching pi's tail edge case.
 */
export const truncateTail = (content: string, options: TruncationOptions = {}): TruncationResult => {
  const maxLines = options.maxLines ?? DEFAULT_MAX_LINES
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES

  const totalBytes = Buffer.byteLength(content, 'utf-8')
  const lines = splitLinesForCounting(content)
  const totalLines = lines.length

  // No truncation needed
  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    return {
      content,
      truncated: false,
      truncatedBy: null,
      totalLines,
      totalBytes,
      outputLines: totalLines,
      outputBytes: totalBytes,
      lastLinePartial: false,
      firstLineExceedsLimit: false,
      maxLines,
      maxBytes,
    }
  }

  // Work backwards from the end
  const outputLinesArr: string[] = []
  let outputBytesCount = 0
  let truncatedBy: 'lines' | 'bytes' = 'lines'
  let lastLinePartial = false

  for (let i = lines.length - 1; i >= 0 && outputLinesArr.length < maxLines; i--) {
    const line = lines[i]!
    const lineBytes = Buffer.byteLength(line, 'utf-8') + (outputLinesArr.length > 0 ? 1 : 0) // +1 for newline

    if (outputBytesCount + lineBytes > maxBytes) {
      truncatedBy = 'bytes'
      // Edge case: no lines added yet and this line exceeds maxBytes — take the
      // end of the line (partial), UTF-8-safe.
      if (outputLinesArr.length === 0) {
        const truncatedLine = truncateStringToBytesFromEnd(line, maxBytes)
        outputLinesArr.unshift(truncatedLine)
        outputBytesCount = Buffer.byteLength(truncatedLine, 'utf-8')
        lastLinePartial = true
      }
      break
    }

    outputLinesArr.unshift(line)
    outputBytesCount += lineBytes
  }

  // Exited due to line limit
  if (outputLinesArr.length >= maxLines && outputBytesCount <= maxBytes) {
    truncatedBy = 'lines'
  }

  const outputContent = outputLinesArr.join('\n')
  const finalOutputBytes = Buffer.byteLength(outputContent, 'utf-8')

  return {
    content: outputContent,
    truncated: true,
    truncatedBy,
    totalLines,
    totalBytes,
    outputLines: outputLinesArr.length,
    outputBytes: finalOutputBytes,
    lastLinePartial,
    firstLineExceedsLimit: false,
    maxLines,
    maxBytes,
  }
}

/**
 * Truncate a string to fit within a byte limit (from the end).
 * Advances past any partial UTF-8 continuation bytes to a character boundary.
 */
const truncateStringToBytesFromEnd = (str: string, maxBytes: number): string => {
  const buf = Buffer.from(str, 'utf-8')
  if (buf.length <= maxBytes) return str

  let start = buf.length - maxBytes
  // Skip continuation bytes (0x80–0xBF) to land on a character start
  while (start < buf.length && (buf[start]! & 0xc0) === 0x80) start++

  return buf.subarray(start).toString('utf-8')
}

/**
 * Truncate a single line to max characters, adding a [truncated] suffix.
 * Used for grep match lines.
 */
export const truncateLine = (
  line: string,
  maxChars: number = GREP_MAX_LINE_LENGTH,
): { text: string; wasTruncated: boolean } => {
  if (line.length <= maxChars) return { text: line, wasTruncated: false }
  return { text: `${line.slice(0, maxChars)}... [truncated]`, wasTruncated: true }
}
