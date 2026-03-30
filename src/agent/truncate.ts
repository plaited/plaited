import * as z from 'zod'

const DEFAULT_MAX_LINES = 2000
const DEFAULT_MAX_BYTES = 50 * 1024

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

const countLines = (buf: Buffer): number => {
  let count = 1
  let offset = 0
  while (true) {
    const idx = Bun.indexOfLine(buf, offset)
    if (idx === -1) break
    count++
    offset = idx + 1
  }
  return count
}

const nthNewlineOffset = (buf: Buffer, n: number): number => {
  let offset = 0
  for (let i = 0; i < n; i++) {
    const idx = Bun.indexOfLine(buf, offset)
    if (idx === -1) return -1
    offset = idx + 1
  }
  return offset
}

export const truncateHead = (text: string, opts: TruncateOptions = {}): TruncationResult => {
  const maxLines = opts.maxLines ?? DEFAULT_MAX_LINES
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const totalBytes = Buffer.byteLength(text)
  const buf = Buffer.from(text)
  const totalLines = countLines(buf)

  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    return { content: text, truncated: false, totalLines, totalBytes, outputLines: totalLines }
  }

  let endOffset = totalBytes
  if (totalLines > maxLines) {
    const off = nthNewlineOffset(buf, maxLines)
    if (off !== -1) endOffset = off
  }
  if (endOffset > maxBytes) endOffset = maxBytes

  const sliced = buf.subarray(0, endOffset).toString()
  const outputLines = countLines(Buffer.from(sliced))

  return { content: sliced, truncated: true, totalLines, totalBytes, outputLines }
}

export const truncateTail = (text: string, opts: TruncateOptions = {}): TruncationResult => {
  const maxLines = opts.maxLines ?? DEFAULT_MAX_LINES
  const maxBytes = opts.maxBytes ?? DEFAULT_MAX_BYTES
  const totalBytes = Buffer.byteLength(text)
  const buf = Buffer.from(text)
  const totalLines = countLines(buf)

  if (totalLines <= maxLines && totalBytes <= maxBytes) {
    return { content: text, truncated: false, totalLines, totalBytes, outputLines: totalLines }
  }

  let startOffset = 0
  if (totalLines > maxLines) {
    const skip = totalLines - maxLines
    const off = nthNewlineOffset(buf, skip)
    if (off !== -1) startOffset = off
  }

  const availableBytes = totalBytes - startOffset
  if (availableBytes > maxBytes) {
    startOffset = totalBytes - maxBytes
  }

  const sliced = buf.subarray(startOffset).toString()
  const outputLines = countLines(Buffer.from(sliced))

  return { content: sliced, truncated: true, totalLines, totalBytes, outputLines }
}
