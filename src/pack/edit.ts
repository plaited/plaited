import * as path from 'node:path'
import * as z from 'zod'
import type { ToolArgs } from './types.ts'

// ----------------------------------------------------------------
// Helpers borrowed from pi's edit-diff.ts semantics (Bun-native rewrite)
// ----------------------------------------------------------------

/**
 * Detect whether a string uses CRLF or LF line endings by finding the
 * first occurrence of each.
 */
const detectLineEnding = (content: string): '\r\n' | '\n' => {
  const crlfIdx = content.indexOf('\r\n')
  const lfIdx = content.indexOf('\n')
  if (lfIdx === -1) return '\n'
  if (crlfIdx === -1) return '\n'
  return crlfIdx < lfIdx ? '\r\n' : '\n'
}

/**
 * Normalize any line-ending style to LF.
 */
const normalizeToLF = (text: string): string => text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')

/**
 * Restore line endings to the detected style.
 */
const restoreLineEndings = (text: string, ending: '\r\n' | '\n'): string =>
  ending === '\r\n' ? text.replace(/\n/g, '\r\n') : text

/**
 * Split content into lines preserving trailing newlines. Each element
 * in the result ends with '\n' except possibly the last (no-trailing-newline).
 */
const splitLinesPreserving = (content: string): string[] => {
  const lines: string[] = []
  let i = 0
  while (i < content.length) {
    const nl = content.indexOf('\n', i)
    if (nl === -1) {
      lines.push(content.slice(i))
      break
    }
    lines.push(content.slice(i, nl + 1))
    i = nl + 1
  }
  return lines
}

// ----------------------------------------------------------------
// Unified patch builder (no `diff` dependency)
//
// We know the exact edit range(s) — old_text → new_text at matched
// line ranges — so we construct hunks deterministically without
// Myers/LCS.
// ----------------------------------------------------------------

interface TextRange {
  startLine: number // 0-indexed line in splitLinesPreserving result
  endLine: number // exclusive
  oldLines: string[]
  newLines: string[]
}

/**
 * Build a standard unified diff patch from an old content and a set of
 * known text ranges that changed.
 */
const buildPatch = (oldLines: string[], ranges: TextRange[], contextLines = 4): string => {
  // Sort by startLine
  const sorted = [...ranges].sort((a, b) => a.startLine - b.startLine)

  const hunks: string[] = []
  let cursor = 0

  for (const range of sorted) {
    const oldLen = range.endLine - range.startLine
    const newLen = range.newLines.length

    // Gather context before
    const beforeStart = Math.max(cursor, range.startLine - contextLines)
    const beforeCtx = oldLines.slice(beforeStart, range.startLine)

    // Gather context after
    const afterEnd = Math.min(oldLines.length, range.endLine + contextLines)
    const afterCtx = oldLines.slice(range.endLine, afterEnd)

    // Compute hunk header: position accounts for context lines
    const hunkOldStart = beforeStart + 1
    const hunkOldLen = beforeCtx.length + oldLen + afterCtx.length
    const hunkNewStart = beforeStart + 1
    const hunkNewLen = beforeCtx.length + newLen + afterCtx.length

    const header = `@@ -${hunkOldStart},${hunkOldLen} +${hunkNewStart},${hunkNewLen} @@`
    const hunkLines: string[] = [header]

    // Context before
    for (const l of beforeCtx) {
      hunkLines.push(` ${l.endsWith('\n') ? l.slice(0, -1) : l}`)
    }

    // Removed lines
    for (const l of range.oldLines) {
      hunkLines.push(`-${l.endsWith('\n') ? l.slice(0, -1) : l}`)
    }

    // Added lines
    for (const l of range.newLines) {
      hunkLines.push(`+${l.endsWith('\n') ? l.slice(0, -1) : l}`)
    }

    // Context after
    for (const l of afterCtx) {
      hunkLines.push(` ${l.endsWith('\n') ? l.slice(0, -1) : l}`)
    }

    hunks.push(hunkLines.join('\n'))
    cursor = afterEnd
  }

  return hunks.join('\n')
}

// ----------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------

export const inputSchema = z.object({
  path: z
    .string()
    .min(1)
    .refine((p) => path.isAbsolute(p), { message: 'path must be absolute' }),
  old_text: z.string().min(1, 'old_text must not be empty'),
  new_text: z.string(),
  replace_all: z.boolean().optional().describe('when true, replaces ALL occurrences of old_text'),
})

export const outputSchema = z.object({
  content: z.string().optional().describe('the new file content'),
  patch: z.string().describe('unified diff patch of the change'),
  replacements: z.number().int().nonnegative().describe('number of replacements made'),
  isError: z.boolean().optional().describe('true when the result is an error rather than a successful edit'),
})

export type EditInput = z.output<typeof inputSchema>
export type EditOutput = z.output<typeof outputSchema>

// ----------------------------------------------------------------
// Run
// ----------------------------------------------------------------

export const run = async (input: EditInput): Promise<EditOutput> => {
  const { path: filePath, old_text, new_text, replace_all } = input

  // Read file
  const bunFile = Bun.file(filePath)
  const exists = await bunFile.exists()
  if (!exists) {
    return { patch: '', replacements: 0, content: `[Error: file not found: ${filePath}]`, isError: true }
  }

  let text: string
  try {
    text = await bunFile.text()
  } catch {
    return { patch: '', replacements: 0, content: `[Error: could not read file: ${filePath}]`, isError: true }
  }

  // Detect and normalize line endings
  const lineEnding = detectLineEnding(text)
  const normalized = normalizeToLF(text)

  // Normalize old_text / new_text too
  const normOld = normalizeToLF(old_text)
  const normNew = normalizeToLF(new_text)

  // Count occurrences
  let searchFrom = 0
  const matchPositions: number[] = []
  while (true) {
    const idx = normalized.indexOf(normOld, searchFrom)
    if (idx === -1) break
    matchPositions.push(idx)
    searchFrom = idx + normOld.length
  }

  if (matchPositions.length === 0) {
    return {
      patch: '',
      replacements: 0,
      content: `[Error: could not find the exact text in ${filePath}. The old_text must match exactly.]`,
      isError: true,
    }
  }

  if (!replace_all && matchPositions.length > 1) {
    return {
      patch: '',
      replacements: 0,
      content: `[Error: found ${matchPositions.length} occurrences of the text in ${filePath}. The text must be unique. Use replace_all for multiple matches.]`,
      isError: true,
    }
  }

  // Build the new content by applying substitutions (right-to-left to
  // keep offsets stable)
  const replacements: Array<{ start: number; end: number }> = []
  let newContent = normalized

  // Process right-to-left to keep offsets stable
  const sortedPositions = [...matchPositions].sort((a, b) => b - a)
  for (const pos of sortedPositions) {
    newContent = newContent.slice(0, pos) + normNew + newContent.slice(pos + normOld.length)
    replacements.push({ start: pos, end: pos + normOld.length })
  }

  // Build patch
  const oldLines = splitLinesPreserving(normalized)
  const newLines = splitLinesPreserving(newContent)

  // Map replacement positions to line ranges
  const ranges: TextRange[] = []
  const sortedForPatch = [...matchPositions].sort((a, b) => a - b)
  for (const pos of sortedForPatch) {
    // Find start line (0-indexed)
    let startLine = 0
    let charPos = 0
    while (startLine < oldLines.length && charPos + oldLines[startLine]!.length <= pos) {
      charPos += oldLines[startLine]!.length
      startLine++
    }

    // Find end line (exclusive)
    let endLine = startLine
    const endCharPos = pos + normOld.length
    while (endLine < oldLines.length && charPos < endCharPos) {
      charPos += oldLines[endLine]!.length
      endLine++
    }

    // The old lines in this range
    const rangeOld = oldLines.slice(startLine, endLine)
    // The new lines need to be calculated from the new content
    const rangeNew = newLines.slice(startLine, startLine + (endLine - startLine))

    ranges.push({ startLine, endLine, oldLines: rangeOld, newLines: rangeNew })
  }

  const patch = buildPatch(oldLines, ranges)

  // Restore original line endings and write
  const finalContent = restoreLineEndings(newContent, lineEnding)
  await Bun.write(filePath, finalContent)

  return {
    content: finalContent,
    patch,
    replacements: matchPositions.length,
  }
}

const editTool: ToolArgs<typeof inputSchema, typeof outputSchema> = Object.freeze({
  name: 'edit',
  description:
    'Edit a file using exact text replacement. old_text must match exactly once unless replace_all is true. Returns a unified diff patch.',
  inputSchema,
  outputSchema,
  run,
})

export default editTool
