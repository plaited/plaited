import { extname, resolve } from 'node:path'
import { $ } from 'bun'
import { RISK_TAG } from '../agent/agent.constants.ts'
import type { ToolHandler } from '../agent/agent.types.ts'
import { makeCli } from './cli.utils.ts'
import {
  BashConfigSchema,
  EditFileConfigSchema,
  ListFilesConfigSchema,
  ReadFileConfigSchema,
  WriteFileConfigSchema,
} from './crud.schemas.ts'
import { truncateHead, truncateTail } from './truncate.ts'

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_LIST_LIMIT = 1000

const TEXT_MIME_PREFIXES = ['text/', 'application/json', 'application/xml', 'application/javascript']

const isTextMime = (mime: string): boolean =>
  TEXT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) || mime.includes('charset=')

const isImageMime = (mime: string): boolean => mime.startsWith('image/')

// ============================================================================
// Edit Helpers — scan-assisted symbol location + whitespace normalization
// ============================================================================

const TRANSPILABLE_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx'])

const LOADER_MAP: Record<string, 'ts' | 'tsx' | 'js' | 'jsx'> = {
  '.ts': 'ts',
  '.tsx': 'tsx',
  '.js': 'js',
  '.jsx': 'jsx',
}

/** Pattern matching the start of a top-level export declaration. */
const EXPORT_DECL_RE = /^export\s+(?:default\s+)?(?:const|let|var|function|class|type|interface|enum|abstract|async\s+function)\s+/m

/**
 * Normalize whitespace: trim trailing whitespace per line.
 * This handles the common case where a model produces old_string
 * with slightly different trailing spaces/tabs.
 */
const normalize = (s: string) =>
  s.split('\n').map((l) => l.trimEnd()).join('\n')

/**
 * Find the source range of an exported symbol by name.
 *
 * @remarks
 * Uses `Bun.Transpiler.scan()` to verify the symbol exists as an export,
 * then locates its declaration via regex. Returns the byte offset range
 * from the declaration start to the next top-level export (or EOF).
 */
const findSymbolRange = (
  content: string,
  symbol: string,
  ext: string,
): { start: number; end: number } | undefined => {
  const loader = LOADER_MAP[ext]
  if (!loader) return undefined

  const transpiler = new Bun.Transpiler({ loader })
  const { exports } = transpiler.scan(content)
  if (!exports.includes(symbol)) return undefined

  // Build regex to find this specific export declaration
  const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const symbolRe = new RegExp(
    `^export\\s+(?:default\\s+)?(?:const|let|var|function|class|type|interface|enum|abstract\\s+class|async\\s+function)\\s+${escaped}\\b`,
    'm',
  )
  const match = symbolRe.exec(content)
  if (!match) return undefined

  const start = match.index

  // Find the next top-level export declaration after this one
  const rest = content.slice(start + match[0].length)
  const nextExport = EXPORT_DECL_RE.exec(rest)
  const end = nextExport ? start + match[0].length + nextExport.index : content.length

  return { start, end }
}

/**
 * Find `oldString` in `content`, applying fallback strategies:
 * 1. Symbol-scoped exact match (if `symbol` provided)
 * 2. Full-file exact match
 * 3. Whitespace-normalized match (trimEnd per line)
 *
 * Returns `{ index, length }` of the match in the original content,
 * or throws with a descriptive error.
 */
const findEditTarget = (
  content: string,
  oldString: string,
  path: string,
  symbol?: string,
): { index: number; length: number } => {
  const ext = extname(path)

  // Strategy 1: symbol-scoped search
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
    // Symbol found but exact match failed — try normalized within range
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

  // Strategy 2: full-file exact match
  const firstIdx = content.indexOf(oldString)
  if (firstIdx !== -1) {
    const secondIdx = content.indexOf(oldString, firstIdx + 1)
    if (secondIdx !== -1) {
      throw new Error(`old_string is not unique in ${path} (found at positions ${firstIdx} and ${secondIdx})`)
    }
    return { index: firstIdx, length: oldString.length }
  }

  // Strategy 3: whitespace-normalized match
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

/**
 * Map a match found in normalized text back to the original content.
 *
 * @remarks
 * Since normalization only does `trimEnd()` per line, line structure and
 * within-line column positions are preserved. We find which line/column
 * the normalized match starts and ends at, then convert those coordinates
 * back to original byte offsets using original line lengths.
 */
const mapNormalizedMatch = (
  baseOffset: number,
  originalSlice: string,
  normMatchIndex: number,
  normMatchLength: number,
): { index: number; length: number } => {
  const origLines = originalSlice.split('\n')
  const normEnd = normMatchIndex + normMatchLength

  // Find (line, col) in normalized space for both start and end
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

    normPos += trimmedLen + 1 // +1 for the \n separator
  }

  // Convert (line, col) → byte offset in original text
  const toOrigOffset = (line: number, col: number): number => {
    let offset = 0
    for (let i = 0; i < line; i++) {
      offset += origLines[i]!.length + 1 // full original line + \n
    }
    const trimmedLen = origLines[line]!.trimEnd().length
    // If col lands on the \n (col == trimmedLen), map to original \n position
    return offset + (col >= trimmedLen ? origLines[line]!.length : col)
  }

  const origStart = toOrigOffset(startLine, startCol)
  const origEnd = toOrigOffset(endLine, endCol)

  return { index: baseOffset + origStart, length: origEnd - origStart }
}

/**
 * Validate that updated content still parses (JS/TS files only).
 * Uses Bun.Transpiler.scan() which throws on syntax errors.
 */
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

// ============================================================================
// Risk Tag Registry — static declarations per built-in tool
// ============================================================================

/**
 * Static risk tag declarations for built-in tools.
 *
 * @remarks
 * Gate bThread predicates inspect these tags to determine routing:
 * - `workspace`-only → execute directly (safe path)
 * - Empty tags → default-deny, routes to Simulate + Judge
 *
 * @public
 */
export const BUILT_IN_RISK_TAGS: Record<string, string[]> = {
  read_file: [RISK_TAG.workspace],
  write_file: [RISK_TAG.workspace],
  edit_file: [RISK_TAG.workspace],
  list_files: [RISK_TAG.workspace],
  bash: [], // empty → default-deny, routes to Simulate + Judge
}

// ============================================================================
// Tool Handlers
// ============================================================================

/**
 * Read a file's contents with truncation and binary detection.
 *
 * @remarks
 * Three possible return shapes based on MIME type:
 * - `text` — file content with truncation metadata
 * - `image` — metadata only (attachment point for Vision model)
 * - `binary` — metadata only (no binary content in context)
 *
 * Supports `offset` (line-based, 0-indexed) and `limit` (line count)
 * for paginated reads of large files.
 *
 * @public
 */
export const readFile: ToolHandler = async (args, ctx) => {
  const path = args.path as string
  const offset = args.offset as number | undefined
  const limit = args.limit as number | undefined
  const resolved = resolve(ctx.workspace, path)
  const file = Bun.file(resolved)

  const size = file.size
  const mime = file.type

  // Image files: metadata only (Vision model attachment point)
  if (isImageMime(mime)) {
    return { type: 'image', path, mimeType: mime, size }
  }

  // Non-text binary files: metadata only
  if (!isTextMime(mime)) {
    return { type: 'binary', path, mimeType: mime, size }
  }

  // Text file: read, apply offset/limit, then truncate
  const text = await file.text()

  let content = text
  if (offset !== undefined || limit !== undefined) {
    const lines = text.split('\n')
    const start = offset ?? 0
    const end = limit !== undefined ? start + limit : lines.length
    content = lines.slice(start, end).join('\n')
  }

  const result = truncateHead(content)
  return { type: 'text', path, ...result }
}

/**
 * Write content to a file, creating parent directories as needed.
 *
 * @public
 */
export const writeFile: ToolHandler = async (args, ctx) => {
  const path = args.path as string
  const content = args.content as string
  const resolved = resolve(ctx.workspace, path)
  await Bun.write(resolved, content)
  return { written: path, bytes: content.length }
}

/**
 * Replace a unique string in a file with new content.
 *
 * @remarks
 * Match strategy (in order):
 * 1. If `symbol` provided → scan() to verify export, search within symbol range
 * 2. Exact substring match (existing behavior)
 * 3. Whitespace-normalized match (trimEnd per line) as fallback
 *
 * After a successful edit on JS/TS files, validates syntax via scan().
 *
 * @public
 */
export const editFile: ToolHandler = async (args, ctx) => {
  const path = args.path as string
  const oldString = args.old_string as string
  const newString = args.new_string as string
  const symbol = args.symbol as string | undefined
  const resolved = resolve(ctx.workspace, path)

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

/**
 * List files and directories matching a glob pattern.
 *
 * @remarks
 * Results are capped at `limit` entries (default 1000) to prevent
 * unbounded output in large repositories.
 *
 * @public
 */
export const listFiles: ToolHandler = async (args, ctx) => {
  const pattern = (args.pattern as string) ?? '**/*'
  const limit = (args.limit as number) ?? DEFAULT_LIST_LIMIT
  const glob = new Bun.Glob(pattern)
  const entries: Array<{ path: string; type: 'file' | 'directory'; size?: number }> = []
  let totalEntries = 0
  for await (const path of glob.scan({ cwd: ctx.workspace, onlyFiles: false })) {
    totalEntries++
    if (entries.length < limit) {
      const resolved = resolve(ctx.workspace, path)
      const ref = Bun.file(resolved)
      const isFile = await ref.exists()
      entries.push(isFile ? { path, type: 'file', size: ref.size } : { path, type: 'directory' })
    }
  }
  return {
    entries,
    truncated: totalEntries > limit,
    totalEntries,
    returnedEntries: entries.length,
  }
}

/**
 * Execute a shell command via Bun Shell.
 *
 * @remarks
 * Output is truncated from the tail (last N lines kept) since the
 * most recent output is usually the most relevant — build errors,
 * test results, final status lines.
 *
 * Uses `Bun.$` (not `/bin/sh`) for sandboxing:
 * - `.cwd(workspace)` locks working directory
 * - `.nothrow()` captures exit code without throwing
 * - `.quiet()` captures stdout/stderr as Buffers
 * - `{ raw: command }` passes the command string to Bun Shell's parser
 *
 * Constitution bThreads inspect the command at the Gate (Layer 1) before
 * execution reaches this handler.
 *
 * @public
 */
export const bash: ToolHandler = async (args, ctx) => {
  const command = args.command as string
  if (ctx.signal.aborted) throw new Error('Aborted')

  const result = await $`${{ raw: command }}`.cwd(ctx.workspace).nothrow().quiet()

  if (result.exitCode !== 0) {
    throw new Error(result.stderr.toString().trim() || `Command exited with code ${result.exitCode}`)
  }
  const output = result.stdout.toString().trim()
  return truncateTail(output)
}

/**
 * Built-in handler registry keyed by tool name.
 *
 * @remarks
 * Used by BP dispatch to look up handlers for `execute` events.
 *
 * @public
 */
export const builtInHandlers: Record<string, ToolHandler> = {
  read_file: readFile,
  write_file: writeFile,
  edit_file: editFile,
  list_files: listFiles,
  bash,
}

// ============================================================================
// CLI Handlers (CLI tool pattern — thin wrappers over library handlers)
// ============================================================================

export const readFileCli = makeCli(readFile, ReadFileConfigSchema, 'read-file')
export const writeFileCli = makeCli(writeFile, WriteFileConfigSchema, 'write-file')
export const editFileCli = makeCli(editFile, EditFileConfigSchema, 'edit-file')
export const listFilesCli = makeCli(listFiles, ListFilesConfigSchema, 'list-files')
export const bashCli = makeCli(bash, BashConfigSchema, 'bash')
