import { Database } from 'bun:sqlite'
import { mkdir } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { Glob } from 'bun'
import * as z from 'zod'
import { parseMarkdownWithFrontmatter } from '../../../src/cli.ts'

const DEFAULT_DB_RELATIVE_PATH = '.plaited/context.sqlite'
const SCHEMA_SQL_PATH = resolve(import.meta.dir, '../assets/schema.sql')
const SKILL_FRONTMATTER_SCHEMA = z
  .object({
    name: z.string().min(1),
    description: z.string().min(1),
    license: z.string().min(1).optional(),
    compatibility: z.string().min(1).optional(),
  })
  .passthrough()

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const TEXT_EXTENSIONS = new Set([...SOURCE_EXTENSIONS, '.md', '.json', '.jsonc', '.yaml', '.yml'])

const SYMBOL_PATTERNS: Array<{ kind: string; pattern: RegExp }> = [
  { kind: 'function', pattern: /\b(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'const', pattern: /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'class', pattern: /\b(?:export\s+)?(?:default\s+)?class\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'type', pattern: /\b(?:export\s+)?type\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'interface', pattern: /\b(?:export\s+)?interface\s+([A-Za-z_$][\w$]*)/ },
  { kind: 'enum', pattern: /\b(?:export\s+)?enum\s+([A-Za-z_$][\w$]*)/ },
]

const IMPORT_PATTERN = /\bimport(?:\s+type)?(?:[\s\w*{},]*?\sfrom\s*)?['"]([^'"]+)['"]/g
const EXPORT_FROM_PATTERN = /\bexport(?:\s+type)?[\s\w*{},]*?\sfrom\s*['"]([^'"]+)['"]/g
const EXPORT_DECLARATION_PATTERN =
  /\bexport\s+(?:default\s+)?(?:async\s+)?(function|const|let|var|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)/g
const EXPORT_NAMED_PATTERN = /\bexport\s*\{([^}]+)\}/g

export const FindingStatusSchema = z.enum(['candidate', 'validated', 'retired'])
export const FindingKindSchema = z.enum(['pattern', 'anti-pattern', 'stale-doc', 'boundary-rule', 'question'])

export const OperationalContextSchema = z.object({
  mode: z.enum(['repo', 'package', 'workspace']),
  cwd: z.string(),
  workspaceRoot: z.string(),
  repoRoot: z.string().optional(),
  packageRoot: z.string().optional(),
  nodeHome: z.string().optional(),
  dbPath: z.string(),
})

export const OperationalContextOverrideSchema = z.object({
  mode: OperationalContextSchema.shape.mode.optional(),
  cwd: z.string().min(1).optional(),
  workspaceRoot: z.string().min(1).optional(),
  repoRoot: z.string().min(1).optional(),
  packageRoot: z.string().min(1).optional(),
  nodeHome: z.string().min(1).optional(),
  dbPath: z.string().min(1).optional(),
})

export const FindingEvidenceSchema = z.object({
  path: z.string().min(1),
  line: z.number().int().positive().optional(),
  symbol: z.string().min(1).optional(),
  excerpt: z.string().min(1).optional(),
})

export const FindingInputSchema = z.object({
  kind: FindingKindSchema,
  status: FindingStatusSchema,
  summary: z.string().min(1),
  details: z.string().optional(),
  evidence: z.array(FindingEvidenceSchema).default([]),
})

export type OperationalContext = z.infer<typeof OperationalContextSchema>
export type OperationalContextOverrides = z.infer<typeof OperationalContextOverrideSchema>
export type FindingStatus = z.infer<typeof FindingStatusSchema>
export type FindingKind = z.infer<typeof FindingKindSchema>
export type FindingInput = z.infer<typeof FindingInputSchema>
export type FindingEvidenceInput = z.infer<typeof FindingEvidenceSchema>

export type SearchResultEntry = {
  source: 'file' | 'doc' | 'finding' | 'rg'
  path?: string
  line?: number
  symbol?: string
  findingId?: number
  status?: FindingStatus
  kind?: FindingKind
  summary?: string
  snippet: string
}

export type ContextAssemblyOutput = {
  ok: true
  filesToRead: string[]
  skillsToUse: string[]
  commandsToRun: string[]
  knownPatterns: string[]
  knownAntiPatterns: string[]
  sourceOfTruth: string[]
  openQuestions: string[]
}

type SymbolRow = {
  name: string
  kind: string
  line: number
}

type ImportRow = {
  specifier: string
  line: number
  isType: boolean
}

type ExportRow = {
  name: string
  kind: string
  line: number
}

let cachedSchemaSql: string | undefined

const nowIso = () => new Date().toISOString()

const toPosix = (value: string) => value.replace(/\\/g, '/')

const isInsideNodeModules = (value: string) => toPosix(value).includes('/node_modules/')

const stripNodeModulesPrefix = (value: string): string | undefined => {
  const normalized = toPosix(resolve(value))
  const marker = '/node_modules/'
  const markerIndex = normalized.indexOf(marker)
  if (markerIndex === -1) {
    return undefined
  }

  return normalized.slice(0, markerIndex)
}

const resolveInputPath = (cwd: string, value?: string): string | undefined => {
  if (!value) {
    return undefined
  }

  return isAbsolute(value) ? value : resolve(cwd, value)
}

const isSubPath = (candidate: string, rootPath: string): boolean => {
  const relativePath = relative(rootPath, candidate)
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

const readPackageName = async (directory: string): Promise<string | undefined> => {
  const packageJsonPath = join(directory, 'package.json')
  const packageJsonFile = Bun.file(packageJsonPath)
  if (!(await packageJsonFile.exists())) {
    return undefined
  }

  try {
    const parsed = await packageJsonFile.json()
    const maybeName =
      typeof parsed === 'object' && parsed !== null && 'name' in parsed
        ? (parsed as { name?: unknown }).name
        : undefined
    return typeof maybeName === 'string' ? maybeName : undefined
  } catch {
    return undefined
  }
}

const isPlaitedSourceRoot = async (directory: string): Promise<boolean> => {
  const agentsFile = Bun.file(join(directory, 'AGENTS.md'))
  if (!(await agentsFile.exists())) {
    return false
  }

  return (await readPackageName(directory)) === 'plaited'
}

const findUpward = async ({
  start,
  predicate,
}: {
  start: string
  predicate: (directory: string) => Promise<boolean>
}): Promise<string | undefined> => {
  let current = resolve(start)

  while (true) {
    if (await predicate(current)) {
      return current
    }

    const parent = dirname(current)
    if (parent === current) {
      return undefined
    }

    current = parent
  }
}

const findWorkspaceRoot = async (cwd: string): Promise<string> => {
  const nodeModulesRoot = stripNodeModulesPrefix(cwd)
  if (nodeModulesRoot) {
    return nodeModulesRoot
  }

  const nearestPackageRoot = await findUpward({
    start: cwd,
    predicate: async (directory) => Bun.file(join(directory, 'package.json')).exists(),
  })

  return nearestPackageRoot ?? cwd
}

export const resolveOperationalContext = async (
  overrides: OperationalContextOverrides = {},
): Promise<OperationalContext> => {
  const cwd = resolve(overrides.cwd ?? process.cwd())
  const explicitRepoRoot = resolveInputPath(cwd, overrides.repoRoot)
  const explicitPackageRoot = resolveInputPath(cwd, overrides.packageRoot)
  const explicitWorkspaceRoot = resolveInputPath(cwd, overrides.workspaceRoot)

  const scriptPackageRoot = resolve(import.meta.dir, '../../..')
  const scriptPackageRootIsSourceRepo = await isPlaitedSourceRoot(scriptPackageRoot)

  const detectedRepoRoot = await findUpward({
    start: cwd,
    predicate: isPlaitedSourceRoot,
  })

  const repoRoot =
    explicitRepoRoot ?? detectedRepoRoot ?? (scriptPackageRootIsSourceRepo ? scriptPackageRoot : undefined)

  const packageRoot = explicitPackageRoot ?? (isInsideNodeModules(scriptPackageRoot) ? scriptPackageRoot : undefined)

  const mode: OperationalContext['mode'] =
    overrides.mode ??
    (repoRoot && (isSubPath(cwd, repoRoot) || scriptPackageRootIsSourceRepo)
      ? 'repo'
      : packageRoot
        ? 'package'
        : 'workspace')

  let workspaceRoot: string
  if (explicitWorkspaceRoot) {
    workspaceRoot = explicitWorkspaceRoot
  } else if (mode === 'repo' && repoRoot) {
    workspaceRoot = repoRoot
  } else if (mode === 'package' && packageRoot) {
    workspaceRoot = stripNodeModulesPrefix(packageRoot) ?? (await findWorkspaceRoot(cwd))
  } else {
    workspaceRoot = await findWorkspaceRoot(cwd)
  }

  const nodeHome = resolveInputPath(cwd, overrides.nodeHome ?? process.env.PLAITED_NODE_HOME)
  const explicitDbPath = resolveInputPath(cwd, overrides.dbPath ?? process.env.PLAITED_CONTEXT_DB)

  let dbPath = explicitDbPath ?? resolve(nodeHome ?? workspaceRoot, DEFAULT_DB_RELATIVE_PATH)

  if (!explicitDbPath && isInsideNodeModules(dbPath)) {
    const safeBase = nodeHome ?? stripNodeModulesPrefix(packageRoot ?? cwd) ?? workspaceRoot
    dbPath = resolve(safeBase, DEFAULT_DB_RELATIVE_PATH)
  }

  return OperationalContextSchema.parse({
    mode,
    cwd,
    workspaceRoot,
    repoRoot,
    packageRoot,
    nodeHome,
    dbPath,
  })
}

const ensureParentDirectory = async (dbPath: string) => {
  if (dbPath === ':memory:' || dbPath.startsWith('file:')) {
    return
  }

  await mkdir(dirname(dbPath), { recursive: true })
}

const getSchemaSql = async () => {
  if (cachedSchemaSql) {
    return cachedSchemaSql
  }

  cachedSchemaSql = await Bun.file(SCHEMA_SQL_PATH).text()
  return cachedSchemaSql
}

export const openContextDatabase = async ({ dbPath }: { dbPath: string }): Promise<Database> => {
  await ensureParentDirectory(dbPath)
  const db = new Database(dbPath, { create: true })
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(await getSchemaSql())
  return db
}

export const closeContextDatabase = (db: Database) => {
  db.close(false)
}

const createLineResolver = (source: string) => {
  const starts: number[] = [0]

  for (let index = 0; index < source.length; index += 1) {
    if (source[index] === '\n') {
      starts.push(index + 1)
    }
  }

  return (index: number): number => {
    let low = 0
    let high = starts.length - 1

    while (low <= high) {
      const middle = Math.floor((low + high) / 2)
      const middleStart = starts[middle] ?? 0
      const nextStart = starts[middle + 1] ?? Number.POSITIVE_INFINITY

      if (middleStart <= index && index < nextStart) {
        return middle + 1
      }

      if (index < middleStart) {
        high = middle - 1
      } else {
        low = middle + 1
      }
    }

    return starts.length
  }
}

const classifyFileKind = (relativePath: string): 'source' | 'skill' | 'doc' | 'other' => {
  if (relativePath.endsWith('/SKILL.md') || relativePath === 'SKILL.md') {
    return 'skill'
  }

  if (relativePath.endsWith('.md')) {
    return 'doc'
  }

  if (SOURCE_EXTENSIONS.has(extname(relativePath).toLowerCase())) {
    return 'source'
  }

  return 'other'
}

const shouldIndexFile = (absolutePath: string): boolean => {
  const ext = extname(absolutePath).toLowerCase()
  if (basename(absolutePath) === 'SKILL.md') {
    return true
  }

  return TEXT_EXTENSIONS.has(ext)
}

const collectFilesForIndexing = async ({
  rootDir,
  include,
}: {
  rootDir: string
  include: string[]
}): Promise<string[]> => {
  const absoluteRoot = resolve(rootDir)
  const files = new Set<string>()

  for (const includePath of include) {
    const trimmed = includePath.trim()
    if (!trimmed) {
      continue
    }

    const normalizedInclude = trimmed.replace(/^\.\//, '').replace(/\/$/, '')
    const glob = new Glob(`${normalizedInclude}/**/*`)

    for await (const foundPath of glob.scan({ cwd: absoluteRoot, absolute: true })) {
      if (!shouldIndexFile(foundPath)) {
        continue
      }

      files.add(resolve(foundPath))
    }
  }

  return [...files].sort((left, right) => left.localeCompare(right))
}

const parseSymbols = (source: string): SymbolRow[] => {
  const lines = source.split(/\r?\n/)
  const seen = new Set<string>()
  const symbols: SymbolRow[] = []

  for (const [index, line] of lines.entries()) {
    const lineNumber = index + 1

    for (const { kind, pattern } of SYMBOL_PATTERNS) {
      const match = pattern.exec(line)
      if (!match) {
        continue
      }

      const name = match[1]
      if (!name) {
        continue
      }

      const dedupeKey = `${name}:${kind}:${lineNumber}`
      if (seen.has(dedupeKey)) {
        continue
      }

      seen.add(dedupeKey)
      symbols.push({
        name,
        kind,
        line: lineNumber,
      })
    }
  }

  return symbols
}

const parseImports = (source: string): ImportRow[] => {
  const lineForIndex = createLineResolver(source)
  const imports: ImportRow[] = []
  const seen = new Set<string>()

  for (const match of source.matchAll(IMPORT_PATTERN)) {
    const specifier = match[1]
    const index = match.index ?? 0
    if (!specifier) {
      continue
    }

    const line = lineForIndex(index)
    const isType = (match[0] ?? '').includes('import type')
    const key = `${specifier}:${line}:${isType}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    imports.push({
      specifier,
      line,
      isType,
    })
  }

  for (const match of source.matchAll(EXPORT_FROM_PATTERN)) {
    const specifier = match[1]
    const index = match.index ?? 0
    if (!specifier) {
      continue
    }

    const line = lineForIndex(index)
    const isType = (match[0] ?? '').includes('export type')
    const key = `${specifier}:${line}:${isType}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    imports.push({
      specifier,
      line,
      isType,
    })
  }

  return imports
}

const parseExports = (source: string): ExportRow[] => {
  const lineForIndex = createLineResolver(source)
  const exports: ExportRow[] = []
  const seen = new Set<string>()

  for (const match of source.matchAll(EXPORT_DECLARATION_PATTERN)) {
    const kind = match[1]
    const name = match[2]
    const index = match.index ?? 0

    if (!kind || !name) {
      continue
    }

    const line = lineForIndex(index)
    const key = `${name}:${kind}:${line}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    exports.push({
      name,
      kind,
      line,
    })
  }

  for (const match of source.matchAll(EXPORT_NAMED_PATTERN)) {
    const content = match[1]
    const index = match.index ?? 0
    if (!content) {
      continue
    }

    const line = lineForIndex(index)
    const parts = content.split(',')

    for (const part of parts) {
      const normalized = part.trim().replace(/^type\s+/, '')
      if (!normalized) {
        continue
      }

      const aliasParts = normalized.split(/\s+as\s+/)
      const exportedName = aliasParts[1] ?? aliasParts[0]
      if (!exportedName) {
        continue
      }

      const key = `${exportedName}:named:${line}`
      if (seen.has(key)) {
        continue
      }

      seen.add(key)
      exports.push({
        name: exportedName,
        kind: 'named',
        line,
      })
    }
  }

  return exports
}

const parseSkillFrontmatter = ({
  path,
  markdown,
}: {
  path: string
  markdown: string
}): {
  name: string
  description: string
  license?: string
  compatibility?: string
} => {
  try {
    const { frontmatter } = parseMarkdownWithFrontmatter(markdown, SKILL_FRONTMATTER_SCHEMA)
    return {
      name: frontmatter.name,
      description: frontmatter.description,
      license: frontmatter.license,
      compatibility: frontmatter.compatibility,
    }
  } catch {
    return {
      name: basename(dirname(path)),
      description: 'Skill frontmatter failed to parse during scan.',
    }
  }
}

const parseDocTitle = (markdown: string): string | undefined => {
  const heading = markdown.match(/^#\s+(.+)$/m)
  return heading?.[1]?.trim()
}

export const indexWorkspace = async ({
  db,
  rootDir,
  include,
  force,
}: {
  db: Database
  rootDir: string
  include: string[]
  force: boolean
}): Promise<{
  filesIndexed: number
  symbolsIndexed: number
  skillsIndexed: number
  docsIndexed: number
}> => {
  if (force) {
    db.exec('DELETE FROM symbols;')
    db.exec('DELETE FROM imports;')
    db.exec('DELETE FROM exports;')
    db.exec('DELETE FROM skills;')
    db.exec('DELETE FROM docs;')
    db.exec('DELETE FROM files;')
  }

  const absoluteRoot = resolve(rootDir)
  const files = await collectFilesForIndexing({ rootDir: absoluteRoot, include })

  const upsertFile = db.query(
    `INSERT INTO files (path, kind, ext, size_bytes, mtime_ms, content, indexed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       kind = excluded.kind,
       ext = excluded.ext,
       size_bytes = excluded.size_bytes,
       mtime_ms = excluded.mtime_ms,
       content = excluded.content,
       indexed_at = excluded.indexed_at`,
  )

  const deleteFileSymbols = db.query('DELETE FROM symbols WHERE file_path = ?')
  const deleteFileImports = db.query('DELETE FROM imports WHERE file_path = ?')
  const deleteFileExports = db.query('DELETE FROM exports WHERE file_path = ?')
  const deleteFileSkill = db.query('DELETE FROM skills WHERE path = ?')
  const deleteFileDoc = db.query('DELETE FROM docs WHERE path = ?')

  const insertSymbol = db.query('INSERT INTO symbols (file_path, name, kind, line) VALUES (?, ?, ?, ?)')
  const insertImport = db.query('INSERT INTO imports (file_path, specifier, line, is_type) VALUES (?, ?, ?, ?)')
  const insertExport = db.query('INSERT INTO exports (file_path, name, kind, line) VALUES (?, ?, ?, ?)')
  const upsertSkill = db.query(
    `INSERT INTO skills (path, name, description, license, compatibility, indexed_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       license = excluded.license,
       compatibility = excluded.compatibility,
       indexed_at = excluded.indexed_at`,
  )
  const upsertDoc = db.query(
    `INSERT INTO docs (path, title, body, indexed_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       title = excluded.title,
       body = excluded.body,
       indexed_at = excluded.indexed_at`,
  )

  let filesIndexed = 0
  let symbolsIndexed = 0
  let skillsIndexed = 0
  let docsIndexed = 0
  const indexedAt = nowIso()

  for (const absolutePath of files) {
    const file = Bun.file(absolutePath)
    if (!(await file.exists())) {
      continue
    }

    const content = await file.text()
    const relativePath = toPosix(relative(absoluteRoot, absolutePath))
    const kind = classifyFileKind(relativePath)
    const ext = extname(relativePath).toLowerCase()

    upsertFile.run(relativePath, kind, ext, file.size, file.lastModified ?? Date.now(), content, indexedAt)

    deleteFileSymbols.run(relativePath)
    deleteFileImports.run(relativePath)
    deleteFileExports.run(relativePath)
    deleteFileSkill.run(relativePath)
    deleteFileDoc.run(relativePath)

    const symbols = parseSymbols(content)
    const imports = parseImports(content)
    const exports = parseExports(content)

    for (const symbol of symbols) {
      insertSymbol.run(relativePath, symbol.name, symbol.kind, symbol.line)
      symbolsIndexed += 1
    }

    for (const importRow of imports) {
      insertImport.run(relativePath, importRow.specifier, importRow.line, importRow.isType ? 1 : 0)
    }

    for (const exportRow of exports) {
      insertExport.run(relativePath, exportRow.name, exportRow.kind, exportRow.line)
    }

    if (kind === 'skill') {
      const skillMeta = parseSkillFrontmatter({
        path: relativePath,
        markdown: content,
      })

      upsertSkill.run(
        relativePath,
        skillMeta.name,
        skillMeta.description,
        skillMeta.license ?? null,
        skillMeta.compatibility ?? null,
        indexedAt,
      )
      skillsIndexed += 1
    }

    if (kind === 'doc' || kind === 'skill') {
      upsertDoc.run(relativePath, parseDocTitle(content) ?? null, content, indexedAt)
      docsIndexed += 1
    }

    filesIndexed += 1
  }

  return {
    filesIndexed,
    symbolsIndexed,
    skillsIndexed,
    docsIndexed,
  }
}

const escapeLike = (value: string): string =>
  value.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')

const buildSnippet = ({ text, query }: { text: string; query: string }) => {
  const normalizedText = text.toLowerCase()
  const normalizedQuery = query.toLowerCase()
  const position = normalizedText.indexOf(normalizedQuery)
  if (position === -1) {
    return text.slice(0, 220).trim()
  }

  const start = Math.max(0, position - 80)
  const end = Math.min(text.length, position + query.length + 140)
  return text.slice(start, end).trim()
}

export const searchContextDatabase = ({
  db,
  query,
  limit,
}: {
  db: Database
  query: string
  limit: number
}): SearchResultEntry[] => {
  const likePattern = `%${escapeLike(query)}%`

  const fileRows = db
    .query(
      `SELECT path, content
       FROM files
       WHERE path LIKE ? ESCAPE '\\' COLLATE NOCASE OR content LIKE ? ESCAPE '\\' COLLATE NOCASE
       LIMIT ?`,
    )
    .all(likePattern, likePattern, limit) as Array<{
    path: string
    content: string
  }>

  const docRows = db
    .query(
      `SELECT path, body
       FROM docs
       WHERE path LIKE ? ESCAPE '\\' COLLATE NOCASE OR body LIKE ? ESCAPE '\\' COLLATE NOCASE
       LIMIT ?`,
    )
    .all(likePattern, likePattern, limit) as Array<{
    path: string
    body: string
  }>

  const findingRows = db
    .query(
      `SELECT id, kind, status, summary, details
       FROM findings
       WHERE summary LIKE ? ESCAPE '\\' COLLATE NOCASE OR COALESCE(details, '') LIKE ? ESCAPE '\\' COLLATE NOCASE
       ORDER BY id DESC
       LIMIT ?`,
    )
    .all(likePattern, likePattern, limit) as Array<{
    id: number
    kind: FindingKind
    status: FindingStatus
    summary: string
    details: string | null
  }>

  const entries: SearchResultEntry[] = [
    ...fileRows.map((row) => ({
      source: 'file' as const,
      path: row.path,
      snippet: buildSnippet({ text: row.content, query }),
    })),
    ...docRows.map((row) => ({
      source: 'doc' as const,
      path: row.path,
      snippet: buildSnippet({ text: row.body, query }),
    })),
    ...findingRows.map((row) => ({
      source: 'finding' as const,
      findingId: row.id,
      kind: row.kind,
      status: row.status,
      summary: row.summary,
      snippet: buildSnippet({ text: `${row.summary}\n${row.details ?? ''}`, query }),
    })),
  ]

  return entries.slice(0, limit)
}

export const searchWithRipgrep = async ({
  rootDir,
  query,
  limit,
}: {
  rootDir: string
  query: string
  limit: number
}): Promise<SearchResultEntry[]> => {
  const rgPath = Bun.which('rg')
  if (!rgPath) {
    return []
  }

  const process = Bun.spawn([rgPath, '--line-number', '--no-heading', '--smart-case', query, rootDir], {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, exitCode] = await Promise.all([new Response(process.stdout).text(), process.exited])
  if (exitCode !== 0 && exitCode !== 1) {
    return []
  }

  const results: SearchResultEntry[] = []

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }

    const match = line.match(/^(.+?):(\d+):(.*)$/)
    if (!match) {
      continue
    }

    const [, path, lineNumber, snippet] = match
    results.push({
      source: 'rg',
      path: toPosix(path ?? ''),
      line: lineNumber ? Number(lineNumber) : undefined,
      snippet: (snippet ?? '').trim(),
    })

    if (results.length >= limit) {
      break
    }
  }

  return results
}

const splitQueryTerms = (task: string): string[] => {
  return task
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
}

const unique = (items: string[]): string[] => [...new Set(items)]
const safeParseJson = (value: string): unknown | null => {
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export const assembleContext = ({
  db,
  task,
  mode,
  paths,
}: {
  db: Database
  task: string
  mode: string
  paths: string[]
}): ContextAssemblyOutput => {
  const terms = splitQueryTerms(task)
  const filesToRead = new Set<string>(paths)

  const fileLimit = Math.max(6, terms.length * 3)
  const searchTerms = terms.length > 0 ? terms : [task]

  for (const term of searchTerms) {
    const likePattern = `%${escapeLike(term)}%`
    const rows = db
      .query(
        `SELECT path
         FROM files
         WHERE path LIKE ? ESCAPE '\\' COLLATE NOCASE OR content LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY indexed_at DESC
         LIMIT ?`,
      )
      .all(likePattern, likePattern, fileLimit) as Array<{ path: string }>

    for (const row of rows) {
      filesToRead.add(row.path)
    }
  }

  const skillRows = new Set<string>()
  for (const term of searchTerms) {
    const likePattern = `%${escapeLike(term)}%`
    const matches = db
      .query(
        `SELECT name
         FROM skills
         WHERE name LIKE ? ESCAPE '\\' COLLATE NOCASE OR description LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY name ASC
         LIMIT 8`,
      )
      .all(likePattern, likePattern) as Array<{ name: string }>
    for (const match of matches) {
      skillRows.add(match.name)
    }
  }

  const findingPatternRows = db
    .query(
      `SELECT summary, status
       FROM findings
       WHERE kind = 'pattern' AND status != 'retired'
       ORDER BY CASE status WHEN 'validated' THEN 0 ELSE 1 END, id DESC
       LIMIT 20`,
    )
    .all() as Array<{ summary: string; status: FindingStatus }>

  const findingAntiPatternRows = db
    .query(
      `SELECT summary, status
       FROM findings
       WHERE kind = 'anti-pattern' AND status != 'retired'
       ORDER BY CASE status WHEN 'validated' THEN 0 ELSE 1 END, id DESC
       LIMIT 20`,
    )
    .all() as Array<{ summary: string; status: FindingStatus }>

  const commandsToRun =
    mode === 'review'
      ? ['bun --bun tsc --noEmit', 'bun test <targeted-files-or-surface>']
      : mode === 'docs'
        ? ['bun skills/plaited-context/scripts/scan.ts "{"rootDir":".","include":["docs","skills"]}"']
        : [
            'bun --bun tsc --noEmit',
            'bun test <targeted-files-or-surface>',
            'bun skills/plaited-context/scripts/search.ts',
          ]

  const sourceOfTruth = unique(['AGENTS.md', ...paths, 'src/', 'skills/', 'docs/'])

  const openQuestions: string[] = []
  if (filesToRead.size === 0) {
    openQuestions.push('No indexed files matched the task. Run scan with a broader include list or force refresh.')
  }
  if (skillRows.size === 0) {
    openQuestions.push('No skill matches found for the task terms. Confirm if a new skill should be introduced.')
  }

  return {
    ok: true,
    filesToRead: [...filesToRead].slice(0, 20),
    skillsToUse: unique([...skillRows]).slice(0, 10),
    commandsToRun,
    knownPatterns: findingPatternRows.map((row) => `${row.status}: ${row.summary}`),
    knownAntiPatterns: findingAntiPatternRows.map((row) => `${row.status}: ${row.summary}`),
    sourceOfTruth,
    openQuestions,
  }
}

export const recordFinding = ({
  db,
  finding,
}: {
  db: Database
  finding: FindingInput
}): {
  findingId: number
  evidenceCount: number
} => {
  if (finding.status !== 'candidate' && finding.evidence.length === 0) {
    throw new Error('Validated or retired findings require at least one evidence item.')
  }

  const insertFinding = db.query(
    `INSERT INTO findings (kind, status, summary, details, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )

  const insertEvidence = db.query(
    `INSERT INTO finding_evidence (finding_id, path, line, symbol, excerpt, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )

  const timestamp = nowIso()
  const transaction = db.transaction(() => {
    const insertResult = insertFinding.run(
      finding.kind,
      finding.status,
      finding.summary,
      finding.details ?? null,
      timestamp,
      timestamp,
    )

    const findingId = Number(insertResult.lastInsertRowid)

    for (const evidence of finding.evidence) {
      insertEvidence.run(
        findingId,
        evidence.path,
        evidence.line ?? null,
        evidence.symbol ?? null,
        evidence.excerpt ?? null,
        timestamp,
      )
    }

    if (finding.status !== 'candidate' && finding.evidence.length === 0) {
      throw new Error('Validated or retired findings require at least one evidence item.')
    }

    return {
      findingId,
      evidenceCount: finding.evidence.length,
    }
  })

  return transaction()
}

export const recordContextRun = ({
  db,
  task,
  mode,
  paths,
  result,
}: {
  db: Database
  task: string
  mode: string
  paths: string[]
  result: ContextAssemblyOutput
}) => {
  db.query(
    `INSERT INTO context_runs (task, mode, paths_json, result_json, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(task, mode, JSON.stringify(paths), JSON.stringify(result), nowIso())
}

export const exportReviewData = ({
  db,
  statuses,
}: {
  db: Database
  statuses: FindingStatus[]
}): {
  findings: Array<{
    id: number
    kind: FindingKind
    status: FindingStatus
    summary: string
    details: string | null
    createdAt: string
    updatedAt: string
    evidence: FindingEvidenceInput[]
  }>
  contextRuns: Array<{
    id: number
    task: string
    mode: string
    paths: string[]
    result: ContextAssemblyOutput | null
    createdAt: string
  }>
} => {
  const placeholders = statuses.map(() => '?').join(', ')

  const findings = db
    .query(
      `SELECT id, kind, status, summary, details, created_at, updated_at
       FROM findings
       WHERE status IN (${placeholders})
       ORDER BY id ASC`,
    )
    .all(...statuses) as Array<{
    id: number
    kind: FindingKind
    status: FindingStatus
    summary: string
    details: string | null
    created_at: string
    updated_at: string
  }>

  const evidenceRows = db
    .query(
      `SELECT finding_id, path, line, symbol, excerpt
       FROM finding_evidence
       WHERE finding_id IN (${findings.map(() => '?').join(', ') || 'NULL'})
       ORDER BY id ASC`,
    )
    .all(...findings.map((finding) => finding.id)) as Array<{
    finding_id: number
    path: string
    line: number | null
    symbol: string | null
    excerpt: string | null
  }>

  const evidenceByFinding = new Map<number, FindingEvidenceInput[]>()

  for (const evidence of evidenceRows) {
    const collection = evidenceByFinding.get(evidence.finding_id) ?? []
    collection.push(
      FindingEvidenceSchema.parse({
        path: evidence.path,
        line: evidence.line ?? undefined,
        symbol: evidence.symbol ?? undefined,
        excerpt: evidence.excerpt ?? undefined,
      }),
    )
    evidenceByFinding.set(evidence.finding_id, collection)
  }

  const contextRunRows = db
    .query(
      `SELECT id, task, mode, paths_json, result_json, created_at
       FROM context_runs
       ORDER BY id ASC`,
    )
    .all() as Array<{
    id: number
    task: string
    mode: string
    paths_json: string
    result_json: string
    created_at: string
  }>

  return {
    findings: findings.map((finding) => ({
      id: finding.id,
      kind: finding.kind,
      status: finding.status,
      summary: finding.summary,
      details: finding.details,
      createdAt: finding.created_at,
      updatedAt: finding.updated_at,
      evidence: evidenceByFinding.get(finding.id) ?? [],
    })),
    contextRuns: contextRunRows.map((row) => {
      const parsedPaths = z.array(z.string()).safeParse(safeParseJson(row.paths_json))
      const parsedResult = z.unknown().safeParse(safeParseJson(row.result_json))

      return {
        id: row.id,
        task: row.task,
        mode: row.mode,
        paths: parsedPaths.success ? parsedPaths.data : [],
        result: parsedResult.success ? (parsedResult.data as ContextAssemblyOutput) : null,
        createdAt: row.created_at,
      }
    }),
  }
}
