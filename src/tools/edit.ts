import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { useTool } from './use-tool.ts'

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

type EditEntry = {
  old_text: string
  new_text: string
}

type Input = {
  path: string
  edits?: EditEntry[]
  /** Legacy single-edit shape — migrated to edits[0] in the handler. */
  old_text?: string
  new_text?: string
  cwd: string
}

export const EditInputSchema: JSONSchemaType<Input> = {
  type: 'object',
  description: 'Edit a single file using exact text replacement.',
  properties: {
    path: { type: 'string', description: "file path — absolute, or relative to the tool's provisioned cwd" },
    edits: {
      type: 'array',
      nullable: true,
      items: {
        type: 'object',
        properties: {
          old_text: {
            type: 'string',
            minLength: 1,
            description:
              'exact text for one targeted replacement — must be unique in the file and must not overlap with any other edits[].old_text',
          },
          new_text: { type: 'string', description: 'replacement text for this edit' },
        },
        required: ['old_text', 'new_text'],
        additionalProperties: false,
      },
      description:
        'one or more targeted replacements, matched against the original file, not incrementally. Do not include overlapping or nested edits.',
    },
    old_text: { type: 'string', nullable: true, description: 'legacy single-edit — migrated to edits[0]' },
    new_text: { type: 'string', nullable: true, description: 'legacy single-edit — migrated to edits[0]' },
    cwd: { type: 'string', description: "the tool's provisioned cwd" },
  },
  required: ['path', 'cwd'],
  additionalProperties: false,
}

type Output = {
  patch: string
  replacements: number
  notice?: string
  message?: string
  isError?: boolean
}

export const EditOutputSchema: JSONSchemaType<Output> = {
  type: 'object',
  description: 'Result of an edit operation.',
  properties: {
    patch: { type: 'string', description: 'unified diff patch of the change' },
    replacements: { type: 'integer', description: 'number of replacements made' },
    notice: { type: 'string', nullable: true, description: 'success notice' },
    message: { type: 'string', nullable: true, description: 'error message when isError' },
    isError: {
      type: 'boolean',
      nullable: true,
      description: 'true when the result is an error rather than a successful edit',
    },
  },
  required: ['patch', 'replacements'],
  additionalProperties: false,
}

/**
 * Edit a file using exact text replacement. Each edits[].old_text must match
 * a unique, non-overlapping region of the original file. Edits are matched
 * against the original file, not incrementally — do not emit overlapping or
 * nested edits.
 *
 * Drop replace_all: each edit must be unique. MINIMAL: no fuzzy/whitespace-
 * tolerant retry (fuzzyFindText). Upgrade path: port pi's normalizeForFuzzyMatch.
 *
 * `cwd` is a required input field — provided by the provisioner. Returns a
 * unified diff patch and a success notice — never the full file content.
 */
export const EDIT_TOOL_NAME = 'edit'
export const edit = useTool(
  {
    name: EDIT_TOOL_NAME,
    description:
      'Edit a file using exact text replacement. Each edits[].old_text must match a unique, non-overlapping region of the original file. Multiple disjoint edits in one call are supported.',
    inputSchema: EditInputSchema,
    outputSchema: EditOutputSchema,
  },
  async ({ path: filePath, edits: editsInput, old_text, new_text, cwd }, _validate) => {
    const resolvedPath = path.resolve(cwd, filePath)

    // Migrate legacy single old_text/new_text to edits[0]
    let edits: EditEntry[]
    if (editsInput && editsInput.length > 0) {
      edits = editsInput
    } else if (typeof old_text === 'string' && typeof new_text === 'string') {
      edits = [{ old_text, new_text }]
    } else {
      return {
        patch: '',
        replacements: 0,
        message: '[Error: edits must contain at least one replacement. Provide edits: [{old_text, new_text}].]',
        isError: true,
      }
    }

    // Read file
    const bunFile = Bun.file(resolvedPath)
    const exists = await bunFile.exists()
    if (!exists) {
      return {
        patch: '',
        replacements: 0,
        message: `[Error: file not found: ${resolvedPath}]`,
        isError: true,
      }
    }

    let text: string
    try {
      text = await bunFile.text()
    } catch {
      return {
        patch: '',
        replacements: 0,
        message: `[Error: could not read file: ${resolvedPath}]`,
        isError: true,
      }
    }

    // Detect and normalize line endings
    const lineEnding = detectLineEnding(text)
    const normalized = normalizeToLF(text)

    // Normalize all edits to LF
    const normalizedEdits = edits.map((e) => ({
      oldText: normalizeToLF(e.old_text),
      newText: normalizeToLF(e.new_text),
    }))

    // Validate: no empty old_text
    for (let i = 0; i < normalizedEdits.length; i++) {
      if (normalizedEdits[i]!.oldText.length === 0) {
        return {
          patch: '',
          replacements: 0,
          message:
            edits.length === 1
              ? `[Error: old_text must not be empty in ${filePath}.]`
              : `[Error: edits[${i}].old_text must not be empty in ${filePath}.]`,
          isError: true,
        }
      }
    }

    // Find match positions for each edit — all matched against the original
    type MatchedEdit = {
      index: number
      position: number
      oldText: string
      newText: string
    }

    const matchedEdits: MatchedEdit[] = []
    for (let i = 0; i < normalizedEdits.length; i++) {
      const { oldText } = normalizedEdits[i]!

      // Count occurrences
      let searchFrom = 0
      let firstMatch = -1
      let count = 0
      while (true) {
        const idx = normalized.indexOf(oldText, searchFrom)
        if (idx === -1) break
        if (count === 0) firstMatch = idx
        count++
        searchFrom = idx + oldText.length
      }

      if (count === 0) {
        return {
          patch: '',
          replacements: 0,
          message:
            edits.length === 1
              ? `[Error: could not find the exact text in ${filePath}. The old_text must match exactly.]`
              : `[Error: could not find edits[${i}] in ${filePath}. The old_text must match exactly.]`,
          isError: true,
        }
      }

      if (count > 1) {
        return {
          patch: '',
          replacements: 0,
          message:
            edits.length === 1
              ? `[Error: found ${count} occurrences of the text in ${filePath}. The text must be unique. Please provide more context.]`
              : `[Error: found ${count} occurrences of edits[${i}] in ${filePath}. Each old_text must be unique.]`,
          isError: true,
        }
      }

      matchedEdits.push({
        index: i,
        position: firstMatch,
        oldText: normalizedEdits[i]!.oldText,
        newText: normalizedEdits[i]!.newText,
      })
    }

    // Check for overlapping edits — reject with a clear error
    matchedEdits.sort((a, b) => a.position - b.position)
    for (let i = 1; i < matchedEdits.length; i++) {
      const prev = matchedEdits[i - 1]!
      const curr = matchedEdits[i]!
      if (prev.position + prev.oldText.length > curr.position) {
        return {
          patch: '',
          replacements: 0,
          message: `[Error: edits[${prev.index}] and edits[${curr.index}] overlap in ${filePath}. Merge them into one edit or target disjoint regions.]`,
          isError: true,
        }
      }
    }

    // Apply substitutions (right-to-left to keep offsets stable)
    let newContent = normalized
    for (let i = matchedEdits.length - 1; i >= 0; i--) {
      const { position, oldText, newText } = matchedEdits[i]!
      newContent = newContent.slice(0, position) + newText + newContent.slice(position + oldText.length)
    }

    // Check for no change
    if (normalized === newContent) {
      return {
        patch: '',
        replacements: 0,
        message: `[Error: no changes made to ${filePath}. The replacement produced identical content.]`,
        isError: true,
      }
    }

    // Build patch with multiple ranges — buildPatch sorts and merges them
    const oldLines = splitLinesPreserving(normalized)
    const ranges: TextRange[] = []
    for (const { position, oldText, newText } of matchedEdits) {
      // First line containing the match (0-indexed, inclusive)
      let startLine = 0
      let charPos = 0
      while (startLine < oldLines.length && charPos + oldLines[startLine]!.length <= position) {
        charPos += oldLines[startLine]!.length
        startLine++
      }
      const prefix = normalized.slice(charPos, position)

      // Last line containing the match (0-indexed, inclusive)
      const matchEnd = position + oldText.length
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
        newLines: splitLinesPreserving(prefix + newText + suffix),
      })
    }

    const patch = buildPatch(oldLines, ranges)

    // Restore original line endings and write
    const finalContent = restoreLineEndings(newContent, lineEnding)
    await Bun.write(resolvedPath, finalContent)

    return {
      patch,
      replacements: matchedEdits.length,
      notice: `Successfully replaced ${matchedEdits.length} block(s) in ${filePath}.`,
    }
  },
)
