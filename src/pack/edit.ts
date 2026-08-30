import * as path from 'node:path'
import * as z from 'zod'
import type { CwdProvision, ToolArgs } from './pack.types.ts'

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
  startLine: number // 0-indexed, inclusive — first line containing the match
  endLine: number // 0-indexed, inclusive — last line containing the match
  oldLines: string[]
  newLines: string[]
}

const stripEol = (line: string): string => (line.endsWith('\n') ? line.slice(0, -1) : line)

/**
 * Build a standard unified diff patch from an old content and a set of
 * known text ranges that changed.
 *
 * New-side accounting: each range's `newLines` are constructed from the
 * replacement itself (prefix + new_text + suffix), and hunk new-start
 * headers carry the accumulated line-count drift from prior hunks —
 * a patch must stay truthful when a replacement changes the line count.
 * Context windows that would overlap are merged into a single hunk
 * (canonical unified-diff behavior; overlapping hunks break reconstruction).
 */
const buildPatch = (oldLines: string[], ranges: TextRange[], contextLines = 4): string => {
  const sorted = [...ranges].sort((a, b) => a.startLine - b.startLine)

  // Merge ranges whose context windows would overlap.
  const merged: Array<{ start: number; end: number; ranges: TextRange[] }> = []
  for (const range of sorted) {
    const last = merged[merged.length - 1]
    if (last && range.startLine - contextLines <= last.end + 1 + contextLines) {
      last.end = Math.max(last.end, range.endLine)
      last.ranges.push(range)
    } else {
      merged.push({ start: range.startLine, end: range.endLine, ranges: [range] })
    }
  }

  const hunks: string[] = []
  let drift = 0 // accumulated new-vs-old line delta from prior hunks
  let cursor = 0 // first old line not yet covered by a hunk

  for (const m of merged) {
    const beforeStart = Math.max(cursor, m.start - contextLines)
    const afterEnd = Math.min(oldLines.length, m.end + 1 + contextLines)
    const hunkOldStart = beforeStart + 1
    const hunkNewStart = hunkOldStart + drift

    const body: string[] = []
    let oldCount = 0
    let newCount = 0
    let i = beforeStart
    let ri = 0
    while (i < afterEnd) {
      const range = m.ranges[ri]
      if (range && i === range.startLine) {
        for (const l of range.oldLines) {
          body.push(`-${stripEol(l)}`)
          oldCount++
        }
        for (const l of range.newLines) {
          body.push(`+${stripEol(l)}`)
          newCount++
        }
        i = range.endLine + 1
        ri++
        continue
      }
      body.push(` ${stripEol(oldLines[i]!)}`)
      oldCount++
      newCount++
      i++
    }

    hunks.push([`@@ -${hunkOldStart},${oldCount} +${hunkNewStart},${newCount} @@`, ...body].join('\n'))

    cursor = m.end + 1
    drift += newCount - oldCount
  }

  return hunks.join('\n')
}

// ----------------------------------------------------------------
// Schemas
// ----------------------------------------------------------------

export const inputSchema = z.object({
  path: z.string().min(1).describe("file path — absolute, or relative to the tool's provisioned cwd"),
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

export const run = async (input: EditInput & CwdProvision): Promise<EditOutput> => {
  const { path: filePath, old_text, new_text, replace_all, cwd } = input
  const resolvedPath = path.resolve(cwd ?? process.cwd(), filePath)

  // Read file
  const bunFile = Bun.file(resolvedPath)
  const exists = await bunFile.exists()
  if (!exists) {
    return { patch: '', replacements: 0, content: `[Error: file not found: ${resolvedPath}]`, isError: true }
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

  // Map replacement positions to line ranges. Each range's `newLines` are
  // constructed from the replacement itself — prefix (start of the first
  // matched line) + new_text + suffix (rest of the last matched line) —
  // because slicing the new content by old coordinates drifts when a
  // replacement changes the line count.
  const ranges: TextRange[] = []
  const sortedForPatch = [...matchPositions].sort((a, b) => a - b)
  for (const pos of sortedForPatch) {
    // First line containing the match (0-indexed, inclusive)
    let startLine = 0
    let charPos = 0
    while (startLine < oldLines.length && charPos + oldLines[startLine]!.length <= pos) {
      charPos += oldLines[startLine]!.length
      startLine++
    }
    const prefix = normalized.slice(charPos, pos)

    // Last line containing the match (0-indexed, inclusive)
    const matchEnd = pos + normOld.length
    let endLine = startLine
    let endChar = charPos
    while (endLine < oldLines.length && endChar + oldLines[endLine]!.length < matchEnd) {
      endChar += oldLines[endLine]!.length
      endLine++
    }
    const suffix = normalized.slice(matchEnd, endChar + oldLines[endLine]!.length)

    ranges.push({
      startLine,
      endLine,
      oldLines: oldLines.slice(startLine, endLine + 1),
      newLines: splitLinesPreserving(prefix + normNew + suffix),
    })
  }

  const patch = buildPatch(oldLines, ranges)

  // Restore original line endings and write
  const finalContent = restoreLineEndings(newContent, lineEnding)
  await Bun.write(resolvedPath, finalContent)

  return {
    content: finalContent,
    patch,
    replacements: matchPositions.length,
  }
}

const editTool: ToolArgs<typeof inputSchema, typeof outputSchema, CwdProvision> = Object.freeze({
  name: 'edit',
  description:
    'Edit a file using exact text replacement. old_text must match exactly once unless replace_all is true. Returns a unified diff patch.',
  inputSchema,
  outputSchema,
  run,
})

export default editTool
