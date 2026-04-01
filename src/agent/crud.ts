import { extname, relative, resolve } from 'node:path'
import { $ } from 'bun'
import type { z } from 'zod'
import { ensureTool } from '../cli.ts'
import { RISK_TAG } from './agent.constants.ts'
import type { ToolContext, ToolHandler } from './agent.types.ts'
import type {
  EditFileConfigSchema,
  GrepConfigSchema,
  ListFilesConfigSchema,
  ReadFileConfigSchema,
  WriteFileConfigSchema,
} from './crud.schemas.ts'
import { truncateHead } from './truncate.ts'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LIST_LIMIT = 1000

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml', 'application/javascript']

const isTextMime = (mime: string): boolean =>
  TEXT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) || mime.includes('charset=')

const isImageMime = (mime: string): boolean => mime.startsWith('image/')

// Edit Helpers — scan-assisted symbol location + whitespace normalization
// ============================================================================

const TRANSPILABLE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])

const LOADER_MAP: Record<string, 'ts' | 'tsx' | 'js' | 'jsx'> = {
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.js': 'js',
  '.jsx': 'jsx',
}

const EXPORT_DECL_RE =
  /^export\s+(?:default\s+)?(?:const|let|var|function|class|type|interface|enum|abstract|async\s+function)\s+/m

const normalize = (s: string) =>
  s
    .split('\n')
    .map((l) => l.trimEnd())
    .join('\n')

const findSymbolRange = (content: string, symbol: string, ext: string): { start: number; end: number } | undefined => {
  const loader = LOADER_MAP[ext]
  if (!loader) return undefined

  const transpiler = new Bun.Transpiler({ loader })
  const { exports } = transpiler.scan(content)
  if (!exports.includes(symbol)) return undefined

  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const symbolRe = new RegExp(
    `^export\\s+(?:default\\s+)?(?:const|let|var|function|class|type|interface|enum|abstract\\s+class|async\\s+function)\\s+${escaped}\\b`,
    'm',
  )
  const match = symbolRe.exec(content)
  if (!match) return undefined

  const start = match.index
  const rest = content.slice(start + match[0].length)
  const nextExport = EXPORT_DECL_RE.exec(rest)
  const end = nextExport ? start + match[0].length + nextExport.index : content.length

  return { start, end }
}

const mapNormalizedMatch = (
  baseOffset: number,
  originalSlice: string,
  normMatchIndex: number,
  normMatchLength: number,
): { index: number; length: number } => {
  const origLines = originalSlice.split('\n')
  const normEnd = normMatchIndex + normMatchLength

  let normPos = 0
  let startLine = 0
  let startCol = 0
  let endLine = 0
  let endCol = 0
  let foundStart = false
  let foundEnd = false

  for (let i = 0; i < origLines.length; i++) {
    const trimmedLen = origLines[i]!.trimEnd().length

    if (!foundStart && normPos + trimmedLen >= normMatchIndex) {
      startLine = i
      startCol = normMatchIndex - normPos
      foundStart = true
    }

    if (!foundEnd && normPos + trimmedLen >= normEnd) {
      endLine = i
      endCol = normEnd - normPos
      foundEnd = true
      break
    }

    normPos += trimmedLen + 1
  }

  const toOrigOffset = (line: number, col: number): number => {
    let offset = 0
    for (let i = 0; i < line; i++) {
      offset += origLines[i]!.length + 1
    }
    const trimmedLen = origLines[line]!.trimEnd().length
    return offset + (col >= trimmedLen ? origLines[line]!.length : col)
  }

  const origStart = toOrigOffset(startLine, startCol)
  const origEnd = toOrigOffset(endLine, endCol)

  return { index: baseOffset + origStart, length: origEnd - origStart }
}

const findEditTarget = (
  content: string,
  oldString: string,
  path: string,
  symbol?: string,
): { index: number; length: number } => {
  const ext = extname(path)

  if (symbol) {
    const range = findSymbolRange(content, symbol, ext)
    if (!range) {
      throw new Error(`Symbol '${symbol}' not found as export in ${path}`)
    }
    const scoped = content.slice(range.start, range.end)
    const idx = scoped.indexOf(oldString)
    if (idx !== -1) {
      const secondIdx = scoped.indexOf(oldString, idx + 1)
      if (secondIdx !== -1) {
        throw new Error(`old_string is not unique within symbol '${symbol}' in ${path}`)
      }
      return { index: range.start + idx, length: oldString.length }
    }
    const normScoped = normalize(scoped)
    const normOld = normalize(oldString)
    const normIdx = normScoped.indexOf(normOld)
    if (normIdx !== -1) {
      const secondNormIdx = normScoped.indexOf(normOld, normIdx + 1)
      if (secondNormIdx !== -1) {
        throw new Error(`old_string is not unique (after normalization) within symbol '${symbol}' in ${path}`)
      }
      return mapNormalizedMatch(range.start, scoped, normIdx, normOld.length)
    }
    throw new Error(`old_string not found within symbol '${symbol}' in ${path}`)
  }

  const firstIdx = content.indexOf(oldString)
  if (firstIdx !== -1) {
    const secondIdx = content.indexOf(oldString, firstIdx + 1)
    if (secondIdx !== -1) {
      throw new Error(`old_string is not unique in ${path} (found at positions ${firstIdx} and ${secondIdx})`)
    }
    return { index: firstIdx, length: oldString.length }
  }

  const normContent = normalize(content)
  const normOld = normalize(oldString)
  const normIdx = normContent.indexOf(normOld)
  if (normIdx !== -1) {
    const secondNormIdx = normContent.indexOf(normOld, normIdx + 1)
    if (secondNormIdx !== -1) {
      throw new Error(`old_string is not unique in ${path} (found after whitespace normalization)`)
    }
    return mapNormalizedMatch(0, content, normIdx, normOld.length)
  }

  throw new Error(`old_string not found in ${path}`)
}

const validateSyntax = (content: string, path: string, ext: string): void => {
  const loader = LOADER_MAP[ext]
  if (!loader) return
  try {
    const transpiler = new Bun.Transpiler({ loader })
    transpiler.scan(content)
  } catch {
    throw new Error(`Edit produced invalid syntax in ${path}`)
  }
}

const RG_PATH = ensureTool('rg')

type ReadFileArgs = z.infer<typeof ReadFileConfigSchema>
type WriteFileArgs = z.infer<typeof WriteFileConfigSchema>
type EditFileArgs = z.infer<typeof EditFileConfigSchema>
type ListFilesArgs = z.infer<typeof ListFilesConfigSchema>
type GrepArgs = z.infer<typeof GrepConfigSchema>

const withToolSignal = (ctx: ToolContext, timeout: number | undefined): AbortSignal => {
  if (timeout === undefined) return ctx.signal
  return AbortSignal.any([ctx.signal, AbortSignal.timeout(timeout)])
}

export const AGENT_CRUD_RISK_TAGS: Record<string, string[]> = {
  read_file: [RISK_TAG.workspace],
  write_file: [RISK_TAG.workspace],
  edit_file: [RISK_TAG.workspace],
  list_files: [RISK_TAG.workspace],
  grep: [RISK_TAG.workspace],
  bash: [],
}

export const readFile: ToolHandler<ReadFileArgs> = async (args, ctx) => {
  const { path, offset, limit } = args
  const resolved = resolve(ctx.cwd, path)
  const file = Bun.file(resolved)
  const size = file.size
  const mime = file.type

  if (isImageMime(mime)) {
    return { type: 'image', path, mimeType: mime, size }
  }

  if (!isTextMime(mime)) {
    return { type: 'binary', path, mimeType: mime, size }
  }

  const text = await file.text()
  let content = text
  if (offset !== undefined || limit !== undefined) {
    const lines = text.split('\n')
    const start = offset ?? 0
    const end = limit !== undefined ? start + limit : lines.length
    content = lines.slice(start, end).join('\n')
  }

  return { type: 'text', path, ...truncateHead(content) }
}

export const writeFile: ToolHandler<WriteFileArgs> = async (args, ctx) => {
  const { path, content } = args
  const resolved = resolve(ctx.cwd, path)
  await Bun.write(resolved, content)
  return { written: path, bytes: content.length }
}

export const editFile: ToolHandler<EditFileArgs> = async (args, ctx) => {
  const { path, old_string: oldString, new_string: newString, symbol } = args
  const resolved = resolve(ctx.cwd, path)

  const content = await Bun.file(resolved).text()
  const { index, length } = findEditTarget(content, oldString, path, symbol)
  const updated = content.slice(0, index) + newString + content.slice(index + length)
  const ext = extname(path)

  if (TRANSPILABLE_EXTS.has(ext)) {
    validateSyntax(updated, path, ext)
  }

  await Bun.write(resolved, updated)
  return { edited: path, bytes: updated.length }
}

export const listFiles: ToolHandler<ListFilesArgs> = async (args, ctx) => {
  const pattern = args.pattern ?? '**/*'
  const limit = args.limit ?? DEFAULT_LIST_LIMIT
  const glob = new Bun.Glob(pattern)
  const entries: Array<{ path: string; type: 'file' | 'directory'; size?: number; mimeType?: string }> = []
  let totalEntries = 0

  for await (const path of glob.scan({ cwd: ctx.cwd, onlyFiles: false })) {
    totalEntries++
    if (entries.length < limit) {
      const resolved = resolve(ctx.cwd, path)
      const ref = Bun.file(resolved)
      const isFile = await ref.exists()
      entries.push(isFile ? { path, type: 'file', size: ref.size, mimeType: ref.type } : { path, type: 'directory' })
    }
  }

  return {
    entries,
    truncated: totalEntries > limit,
    totalEntries,
    returnedEntries: entries.length,
  }
}

export const grep: ToolHandler<GrepArgs> = async (args, ctx) => {
  const { pattern } = args
  const searchPath = args.path ? resolve(ctx.cwd, args.path) : ctx.cwd
  const limit = args.limit ?? 100
  const signal = withToolSignal(ctx, args.timeout)

  if (signal.aborted) throw new Error('Aborted')

  const rgArgs = ['--json']
  if (args.ignoreCase) rgArgs.push('--ignore-case')
  if (args.literal) rgArgs.push('--fixed-strings')
  if (args.glob) rgArgs.push('--glob', args.glob)
  if (args.context != null) rgArgs.push('--context', String(args.context))

  const result = await $`${RG_PATH} ${rgArgs} ${pattern} ${searchPath}`.nothrow().quiet()

  if (result.exitCode !== 0 && result.exitCode !== 1) {
    throw new Error(result.stderr.toString().trim() || `rg exited with code ${result.exitCode}`)
  }

  const stdout = result.stdout.toString()
  if (!stdout.trim()) return { matches: [], totalMatches: 0, truncated: false }

  type GrepMatch = {
    path: string
    line: number
    text: string
    context?: { before?: string[]; after?: string[] }
  }

  const matches: GrepMatch[] = []
  let totalMatches = 0
  let pendingBefore: string[] = []
  let lastMatch: GrepMatch | undefined

  for await (const entry of Bun.JSONL.parse(stdout)) {
    const record = entry as { type: string; data: Record<string, unknown> }
    if (record.type === 'context') {
      const lineText = ((record.data.lines as { text: string }).text ?? '').replace(/\n$/, '')
      const lineNumber = record.data.line_number as number

      if (lastMatch && lineNumber > lastMatch.line) {
        lastMatch.context ??= {}
        lastMatch.context.after ??= []
        lastMatch.context.after.push(lineText)
      } else {
        pendingBefore.push(lineText)
      }
    } else if (record.type === 'match') {
      totalMatches++
      if (matches.length >= limit) continue

      const pathData = record.data.path as { text: string }
      const matchPath = relative(ctx.cwd, pathData.text)
      const lineText = ((record.data.lines as { text: string }).text ?? '').replace(/\n$/, '')
      const match: GrepMatch = {
        path: matchPath,
        line: record.data.line_number as number,
        text: lineText,
      }

      if (pendingBefore.length > 0) {
        match.context = { before: pendingBefore }
        pendingBefore = []
      }

      matches.push(match)
      lastMatch = match
    } else if (record.type === 'begin') {
      pendingBefore = []
      lastMatch = undefined
    }
  }

  return { matches, totalMatches, truncated: totalMatches > limit }
}
