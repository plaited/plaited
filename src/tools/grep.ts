import * as path from 'node:path'
import type { JSONSchemaType } from 'ajv'
import { DEFAULT_MAX_BYTES, formatSize, GREP_MAX_LINE_LENGTH, truncateHead, truncateLine } from './truncate.ts'
import { useTool } from './use-tool.ts'

const DEFAULT_LIMIT = 100

type MatchEntry = {
  path: string
  line: number
  text: string
}

type ScanResult = {
  matches: MatchEntry[]
  matchLimitReached: boolean
  linesTruncated: boolean
}

const sanitizeLineText = (text: string): string => text.replace(/\r\n/g, '\n').replace(/\r/g, '').replace(/\n$/, '')

const relativizePath = (filePath: string, searchPath: string): string => {
  const relative = path.relative(searchPath, filePath)
  if (relative && !relative.startsWith('..')) return relative.replace(/\\/g, '/')
  return path.basename(filePath)
}

/**
 * Run grep using ripgrep with --json output.
 *
 * --json parsing fixes the colon-in-path bug (colon-splitting breaks on paths
 * containing colons). Context lines are read from the file when context > 0
 * (pi approach — avoids associating context events with the wrong match).
 */
const runWithRg = async ({
  pattern,
  searchPath,
  include,
  ignoreCase,
  literal,
  context,
  limit,
  rgPath,
}: {
  pattern: string
  searchPath: string
  include?: string
  ignoreCase?: boolean
  literal?: boolean
  context?: number
  limit: number
  rgPath: string
}): Promise<ScanResult> => {
  const args = ['--json', '--line-number', '--color', 'never', '--hidden']
  if (ignoreCase) args.push('--ignore-case')
  if (literal) args.push('--fixed-strings')
  if (include) args.push('--glob', include)
  if (context && context > 0) args.push('-C', String(context))
  args.push('--', pattern, searchPath)

  try {
    const proc = Bun.spawn([rgPath, ...args], {
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stdout = await new Response(proc.stdout).text()
    await new Response(proc.stderr).text()

    type RgEvent = {
      type: string
      data?: {
        path?: { text?: string }
        line_number?: number
        lines?: { text?: string }
      }
    }

    // Parse JSON lines — extract match events only.
    const matchEvents: Array<{ absPath: string; line: number; rawText: string }> = []
    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      let event: RgEvent
      try {
        event = JSON.parse(line) as RgEvent
      } catch {
        continue
      }
      if (event.type === 'match') {
        const filePath = event.data?.path?.text
        const lineNumber = event.data?.line_number
        const lineText = event.data?.lines?.text
        if (filePath && typeof lineNumber === 'number' && lineText !== undefined) {
          matchEvents.push({ absPath: filePath, line: lineNumber, rawText: lineText })
        }
      }
    }

    const contextValue = context && context > 0 ? context : 0

    // File line cache for context extraction.
    const fileCache = new Map<string, string[]>()
    const getFileLines = async (filePath: string): Promise<string[]> => {
      let lines = fileCache.get(filePath)
      if (!lines) {
        try {
          const content = await Bun.file(filePath).text()
          lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
        } catch {
          lines = []
        }
        fileCache.set(filePath, lines)
      }
      return lines
    }

    const matches: MatchEntry[] = []
    let matchLimitReached = false
    let linesTruncated = false

    for (const evt of matchEvents) {
      if (matches.length >= limit) {
        matchLimitReached = true
        break
      }

      const relPath = relativizePath(evt.absPath, searchPath)
      const matchText = sanitizeLineText(evt.rawText)

      if (contextValue > 0) {
        const lines = await getFileLines(evt.absPath)
        const start = Math.max(1, evt.line - contextValue)
        const end = Math.min(lines.length, evt.line + contextValue)
        const block: string[] = []
        for (let current = start; current <= end; current++) {
          const lineText = sanitizeLineText(lines[current - 1] ?? '')
          const { text: truncatedText, wasTruncated } = truncateLine(lineText)
          if (wasTruncated) linesTruncated = true
          if (current === evt.line) {
            block.push(`${relPath}:${current}: ${truncatedText}`)
          } else {
            block.push(`${relPath}-${current}- ${truncatedText}`)
          }
        }
        matches.push({ path: relPath, line: evt.line, text: block.join('\n') })
      } else {
        const { text: truncatedText, wasTruncated } = truncateLine(matchText)
        if (wasTruncated) linesTruncated = true
        matches.push({ path: relPath, line: evt.line, text: truncatedText })
      }
    }

    return { matches, matchLimitReached, linesTruncated }
  } catch {
    return { matches: [], matchLimitReached: false, linesTruncated: false }
  }
}

/**
 * JS line-scanner fallback when rg is not on PATH.
 *
 * MINIMAL: bounded to 100 files / 1000 lines per file, no .gitignore respect,
 * no exclude/invert-glob support. Upgrade path: install rg, or add
 * walk + gitignore filter.
 */
const runFallback = async ({
  pattern,
  searchPath,
  include,
  ignoreCase,
  literal,
  context,
  limit,
}: {
  pattern: string
  searchPath: string
  include?: string
  ignoreCase?: boolean
  literal?: boolean
  context?: number
  limit: number
}): Promise<ScanResult> => {
  let regex: RegExp
  try {
    const flags = ignoreCase ? 'i' : ''
    const source = literal ? pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') : pattern
    regex = new RegExp(source, flags)
  } catch {
    return { matches: [], matchLimitReached: false, linesTruncated: false }
  }

  const rawGlob = include ?? '**/*'
  const globPattern = rawGlob.startsWith('**/') || rawGlob.startsWith('/') ? rawGlob : `**/${rawGlob}`

  const contextValue = context && context > 0 ? context : 0
  const matches: MatchEntry[] = []
  let matchLimitReached = false
  let linesTruncated = false
  let fileCount = 0

  try {
    const glob = new Bun.Glob(globPattern)
    for await (const file of glob.scan({ cwd: searchPath })) {
      if (++fileCount > 100) break // MINIMAL: bounded
      const absPath = path.isAbsolute(file) ? file : path.join(searchPath, file)
      const bunFile = Bun.file(absPath)
      const exists = await bunFile.exists()
      if (!exists) continue

      let text: string
      try {
        text = await bunFile.text()
      } catch {
        continue
      }

      const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
      const relPath = file

      for (let i = 0; i < Math.min(lines.length, 1000); i++) {
        const lineText = sanitizeLineText(lines[i] ?? '')
        let isMatch: boolean
        if (literal) {
          isMatch = ignoreCase ? lineText.toLowerCase().includes(pattern.toLowerCase()) : lineText.includes(pattern)
        } else {
          isMatch = regex.test(lineText)
        }
        if (isMatch) {
          if (matches.length >= limit) {
            matchLimitReached = true
            break
          }

          if (contextValue > 0) {
            const lineNum = i + 1
            const start = Math.max(1, lineNum - contextValue)
            const end = Math.min(lines.length, lineNum + contextValue)
            const block: string[] = []
            for (let current = start; current <= end; current++) {
              const ctxText = sanitizeLineText(lines[current - 1] ?? '')
              const { text: truncatedText, wasTruncated } = truncateLine(ctxText)
              if (wasTruncated) linesTruncated = true
              if (current === lineNum) {
                block.push(`${relPath}:${current}: ${truncatedText}`)
              } else {
                block.push(`${relPath}-${current}- ${truncatedText}`)
              }
            }
            matches.push({ path: relPath, line: lineNum, text: block.join('\n') })
          } else {
            const { text: truncatedText, wasTruncated } = truncateLine(lineText)
            if (wasTruncated) linesTruncated = true
            matches.push({ path: relPath, line: i + 1, text: truncatedText })
          }
        }
      }
      if (matchLimitReached) break
    }
  } catch {
    // Swallow errors in fallback
  }

  return { matches, matchLimitReached, linesTruncated }
}

type Input = {
  pattern: string
  cwd: string
  dir?: string
  include?: string
  limit?: number
  ignoreCase?: boolean
  literal?: boolean
  context?: number
}

export const GrepInputSchema: JSONSchemaType<Input> = {
  type: 'object',
  properties: {
    pattern: { type: 'string', minLength: 1, description: 'pattern to search for (regex or literal string)' },
    cwd: { type: 'string', description: "the tool's provisioned cwd" },
    dir: {
      type: 'string',
      nullable: true,
      description: "directory to search (defaults to the tool's provisioned cwd)",
    },
    include: { type: 'string', nullable: true, description: 'glob filter for file names (e.g. "*.ts")' },
    limit: {
      type: 'integer',
      nullable: true,
      minimum: 1,
      description: `maximum number of matches to return (default: ${DEFAULT_LIMIT})`,
    },
    ignoreCase: { type: 'boolean', nullable: true, description: 'case-insensitive search (default: false)' },
    literal: {
      type: 'boolean',
      nullable: true,
      description: 'treat pattern as literal string instead of regex (default: false)',
    },
    context: {
      type: 'integer',
      nullable: true,
      minimum: 0,
      description: 'lines of context to show before and after each match (default: 0)',
    },
  },
  required: ['pattern', 'cwd'],
  additionalProperties: false,
}

type Output = {
  matches: Array<{ path: string; line: number; text: string }>
  truncated: boolean
  limit: number
  notice?: string
  message?: string
  isError?: boolean
}

export const GrepOutputSchema: JSONSchemaType<Output> = {
  type: 'object',
  properties: {
    matches: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          path: { type: 'string' },
          line: { type: 'integer' },
          text: { type: 'string' },
        },
        required: ['path', 'line', 'text'],
        additionalProperties: false,
      },
    },
    truncated: {
      type: 'boolean',
      description: 'true when any truncation occurred (match limit, byte cap, or line cap)',
    },
    limit: { type: 'integer', description: 'the match limit that was applied' },
    notice: {
      type: 'string',
      nullable: true,
      description: 'continuation hints when truncation occurred — joined with ". "',
    },
    message: { type: 'string', nullable: true, description: 'error detail when isError — states what failed' },
    isError: { type: 'boolean', nullable: true, description: 'true when the operation failed' },
  },
  required: ['matches', 'truncated', 'limit'],
  additionalProperties: false,
}

/**
 * Search for a pattern in files using ripgrep (rg) when available, with a JS
 * line-scanner fallback. Returns matching lines with file path, line number,
 * and text. Long lines are truncated to 500 chars; total output is capped at
 * 50KB; match count is capped at `limit` (default 100).
 *
 * `cwd` is a required input field — provided by the provisioner. Returns an
 * info message when no matches are found, and an error result on failure.
 */
export const GREP_TOOL_NAME = 'grep'
export const grep = useTool(
  {
    name: GREP_TOOL_NAME,
    description:
      `Search for a pattern in files. Prefers ripgrep (rg) when available; falls back to a JS line scanner. ` +
      `Long lines are truncated to ${GREP_MAX_LINE_LENGTH} chars. Output is capped at ${DEFAULT_LIMIT} matches or ` +
      `${formatSize(DEFAULT_MAX_BYTES)} (whichever is hit first).`,
    inputSchema: GrepInputSchema,
    outputSchema: GrepOutputSchema,
  },
  async ({ pattern, dir, include, limit, ignoreCase, literal, context, cwd }, _validate) => {
    try {
      const resolvedSearch = path.resolve(cwd, dir ?? '.')
      const effectiveLimit = Math.max(1, limit ?? DEFAULT_LIMIT)

      const rgPath = Bun.which('rg')
      const scanResult = rgPath
        ? await runWithRg({
            pattern,
            searchPath: resolvedSearch,
            include,
            ignoreCase,
            literal,
            context,
            limit: effectiveLimit,
            rgPath,
          })
        : await runFallback({
            pattern,
            searchPath: resolvedSearch,
            include,
            ignoreCase,
            literal,
            context,
            limit: effectiveLimit,
          })

      const { matches, matchLimitReached, linesTruncated } = scanResult

      if (matches.length === 0) {
        return {
          matches: [],
          truncated: false,
          limit: effectiveLimit,
          message: `[Info: no matches found for pattern "${pattern}" in ${resolvedSearch}]`,
        }
      }

      // Apply total byte cap via truncateHead (no line limit — match limit
      // already caps rows). Serialize, truncate, map back to match count.
      const serialized = matches.map((m) => `${m.path}:${m.line}: ${m.text}`).join('\n')
      const truncation = truncateHead(serialized, { maxLines: Number.MAX_SAFE_INTEGER })
      const byteTruncated = truncation.truncated

      let cappedMatches = matches
      if (byteTruncated) {
        // Count how many matches fit within the truncated output. Each match
        // serialization spans text.split('\n').length lines (the path:line:
        // prefix is part of the first line of text).
        const outputLineCount = truncation.content.split('\n').length
        let lineCount = 0
        let matchIndex = 0
        while (matchIndex < matches.length) {
          const matchLines = matches[matchIndex]!.text.split('\n').length
          if (lineCount + matchLines > outputLineCount) break
          lineCount += matchLines
          matchIndex++
        }
        cappedMatches = matches.slice(0, matchIndex)
      }

      // Build actionable notices.
      const notices: string[] = []
      if (matchLimitReached) {
        notices.push(
          `${effectiveLimit} matches limit reached. Use limit=${effectiveLimit * 2} for more, or refine pattern`,
        )
      }
      if (byteTruncated) {
        notices.push(`${formatSize(DEFAULT_MAX_BYTES)} limit reached`)
      }
      if (linesTruncated) {
        notices.push(`Some lines truncated to ${GREP_MAX_LINE_LENGTH} chars. Use read tool to see full lines`)
      }

      const result: Output = {
        matches: cappedMatches,
        truncated: matchLimitReached || byteTruncated || linesTruncated,
        limit: effectiveLimit,
      }
      if (notices.length > 0) {
        result.notice = notices.join('. ')
      }
      return result
    } catch (err) {
      return {
        matches: [],
        truncated: false,
        limit: limit ?? DEFAULT_LIMIT,
        message: `[Error: failed to search: ${(err as Error).message}]`,
        isError: true,
      }
    }
  },
)
