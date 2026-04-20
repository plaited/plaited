import { Database } from 'bun:sqlite'
import { mkdir, stat } from 'node:fs/promises'
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from 'node:path'
import { Glob } from 'bun'
import * as z from 'zod'
import {
  findSkillDirectories,
  getSkillInstructionResourceLinks,
  type LocalMarkdownLink,
  loadSkillCatalog,
  loadSkillFrontmatter,
  loadSkillInstructions,
  validateMarkdownLocalLinks,
} from '../../../src/cli.ts'

const DEFAULT_DB_RELATIVE_PATH = '.plaited/context.sqlite'
const SCHEMA_SQL_PATH = resolve(import.meta.dir, '../assets/schema.sql')

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])
const CONFIG_EXTENSIONS = new Set(['.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf'])
const TEXT_EXTENSIONS = new Set([...SOURCE_EXTENSIONS, '.md', ...CONFIG_EXTENSIONS])
const CONFIG_BASENAMES = new Set([
  'package.json',
  'tsconfig.json',
  'biome.json',
  'biome.jsonc',
  'bunfig.toml',
  '.env',
  '.env.example',
  '.env.schema',
])

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

export const FindingStatusSchema = z
  .enum(['candidate', 'validated', 'retired'])
  .describe('Lifecycle status for a recorded finding.')
export const FindingKindSchema = z
  .enum(['pattern', 'anti-pattern', 'stale-doc', 'boundary-rule', 'question'])
  .describe('Classification for a recorded finding.')

export const OperationalContextSchema = z
  .object({
    mode: z.enum(['repo', 'package', 'workspace']).describe('Resolved operating mode for context lookup.'),
    cwd: z.string().describe('Working directory used for resolution and relative paths.'),
    workspaceRoot: z.string().describe('Resolved workspace root used for local defaults.'),
    repoRoot: z.string().optional().describe('Resolved Plaited source repo root when operating in repo mode.'),
    packageRoot: z.string().optional().describe('Resolved installed package root when operating in package mode.'),
    nodeHome: z.string().optional().describe('Optional node home used for writable local state defaults.'),
    dbPath: z.string().describe('Resolved writable SQLite database path for plaited-context.'),
  })
  .describe('Fully resolved operational context for plaited-context scripts.')

export const OperationalContextOverrideSchema = z
  .object({
    mode: OperationalContextSchema.shape.mode.optional().describe('Optional explicit mode override.'),
    cwd: z.string().min(1).optional().describe('Optional working directory override.'),
    workspaceRoot: z.string().min(1).optional().describe('Optional workspace root override.'),
    repoRoot: z.string().min(1).optional().describe('Optional explicit repo root override.'),
    packageRoot: z.string().min(1).optional().describe('Optional explicit package root override.'),
    nodeHome: z.string().min(1).optional().describe('Optional node home for writable local state.'),
    dbPath: z.string().min(1).optional().describe('Optional explicit SQLite DB path override.'),
  })
  .describe('Optional operational context overrides accepted by all plaited-context scripts.')

export const FindingEvidenceSchema = z
  .object({
    path: z.string().min(1).describe('Source file path supporting the finding.'),
    line: z.number().int().positive().optional().describe('1-based line number for the evidence location.'),
    symbol: z.string().min(1).optional().describe('Optional symbol name tied to the evidence.'),
    excerpt: z.string().min(1).optional().describe('Optional short source excerpt for review context.'),
  })
  .describe('Source-grounded evidence attached to a finding.')

export const FindingInputSchema = z
  .object({
    kind: FindingKindSchema.describe('Finding category.'),
    status: FindingStatusSchema.describe('Initial lifecycle status.'),
    summary: z.string().min(1).describe('Short reviewer-facing finding statement.'),
    details: z.string().optional().describe('Optional longer rationale or context.'),
    evidence: z.array(FindingEvidenceSchema).default([]).describe('Evidence entries supporting the finding.'),
  })
  .describe('Finding payload accepted by record-finding script.')

export type OperationalContext = z.infer<typeof OperationalContextSchema>
export type OperationalContextOverrides = z.infer<typeof OperationalContextOverrideSchema>
export type FindingStatus = z.infer<typeof FindingStatusSchema>
export type FindingKind = z.infer<typeof FindingKindSchema>
export type FindingInput = z.infer<typeof FindingInputSchema>
export type FindingEvidenceInput = z.infer<typeof FindingEvidenceSchema>

export type SearchResultEntry = {
  source: 'file' | 'wiki' | 'finding' | 'rg'
  path?: string
  line?: number
  symbol?: string
  findingId?: number
  status?: FindingStatus
  kind?: FindingKind
  summary?: string
  snippet: string
}

export type ContextAuthority = 'source' | 'agent-instructions' | 'skill' | 'wiki' | 'other'

export type ContextAuthorityEntry = {
  rank: number
  authority: ContextAuthority
  label: string
  description: string
}

export type ContextAssemblyOutput = {
  ok: true
  filesToRead: string[]
  skillsToUse: string[]
  commandsToRun: string[]
  knownPatterns: string[]
  knownAntiPatterns: string[]
  sourceOfTruth: string[]
  authorityOrder: ContextAuthorityEntry[]
  authorityPolicy: string
  openQuestions: string[]
}

export type WikiBrokenLink = {
  path: string
  linkValue: string
  linkText: string
  targetPath: string | null
  reason: string
  authority: 'wiki'
  provenance: string[]
}

export type WikiCleanupCandidateKind =
  | 'broken-local-link'
  | 'missing-target-file'
  | 'retired-skill-reference'
  | 'orphan-page'

export type WikiCleanupCandidate = {
  path: string
  kind: WikiCleanupCandidateKind
  reason: string
  authority: 'wiki'
  provenance: string[]
}

export type WikiContextPage = {
  path: string
  title: string
  reason: string
  authority: 'wiki'
  headings: string[]
  outboundLocalReferences: string[]
  warnings: string[]
  provenance: {
    matchedTerms: string[]
    matchedIn: Array<'path' | 'title' | 'heading' | 'body' | 'outbound-link' | 'task-path'>
  }
}

export type WikiContextAgentInstruction = {
  path: string
  scopePath: string
  authority: 'agent-instructions'
  reason: string
  provenance: string[]
}

export type WikiContextSkill = {
  name: string
  path: string
  authority: 'skill'
  reason: string
  provenance: string[]
}

export type WikiContextOutput = {
  ok: true
  wikiPages: WikiContextPage[]
  agentInstructions: WikiContextAgentInstruction[]
  skills: WikiContextSkill[]
  sourceOfTruth: ContextAuthorityEntry[]
  authorityPolicy: string
  brokenLinks: WikiBrokenLink[]
  cleanupCandidates: WikiCleanupCandidate[]
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

type DocHeadingRow = {
  heading: string
  level: number
  line: number
  orderIndex: number
}

type DocLinkRow = {
  value: string
  text: string
  targetPath: string | null
  targetExists: boolean
}

export const CONTEXT_AUTHORITY_ORDER: ContextAuthorityEntry[] = [
  {
    rank: 1,
    authority: 'source',
    label: 'code',
    description: 'src/ code and tests',
  },
  {
    rank: 2,
    authority: 'agent-instructions',
    label: 'agent-instructions',
    description: 'AGENTS.md operational instructions by path scope',
  },
  {
    rank: 3,
    authority: 'skill',
    label: 'skills',
    description: 'skills/*/SKILL.md and applicable skill scripts',
  },
  {
    rank: 4,
    authority: 'wiki',
    label: 'wiki',
    description: 'wiki/reference docs',
  },
  {
    rank: 5,
    authority: 'other',
    label: 'other',
    description: 'unclassified indexed text',
  },
]

const AUTHORITY_POLICY_TEXT =
  'When sources conflict, code and tests outrank AGENTS.md, AGENTS.md outranks skills, and skills outrank wiki.'

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
  const inferredPackageRoot = isInsideNodeModules(scriptPackageRoot) ? scriptPackageRoot : undefined

  const detectedRepoRoot = await findUpward({
    start: cwd,
    predicate: isPlaitedSourceRoot,
  })

  const repoRoot = explicitRepoRoot ?? detectedRepoRoot
  const packageRoot = explicitPackageRoot ?? inferredPackageRoot

  const mode: OperationalContext['mode'] =
    overrides.mode ??
    (explicitRepoRoot
      ? 'repo'
      : detectedRepoRoot
        ? 'repo'
        : explicitPackageRoot
          ? 'package'
          : inferredPackageRoot
            ? 'package'
            : 'workspace')

  let workspaceRoot: string
  if (explicitWorkspaceRoot) {
    workspaceRoot = explicitWorkspaceRoot
  } else if (mode === 'repo') {
    workspaceRoot = repoRoot ?? cwd
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

const classifyFileKind = (
  relativePath: string,
): 'source' | 'skill' | 'agent-instructions' | 'wiki' | 'config' | 'other' => {
  const normalizedPath = toPosix(relativePath)
  const filename = basename(normalizedPath)
  const lowerFilename = filename.toLowerCase()

  if (filename === 'AGENTS.md') {
    return 'agent-instructions'
  }

  if (filename === 'SKILL.md') {
    return 'skill'
  }

  const extension = extname(normalizedPath).toLowerCase()
  if (SOURCE_EXTENSIONS.has(extension)) {
    return 'source'
  }

  if (extension === '.md') {
    return 'wiki'
  }

  if (CONFIG_EXTENSIONS.has(extension) || CONFIG_BASENAMES.has(lowerFilename)) {
    return 'config'
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

const validateIncludePath = ({ absoluteRoot, includePath }: { absoluteRoot: string; includePath: string }): string => {
  if (isAbsolute(includePath)) {
    throw new Error(`Invalid include path '${includePath}': absolute paths are not allowed.`)
  }

  const resolvedIncludePath = resolve(absoluteRoot, includePath)
  if (!isSubPath(resolvedIncludePath, absoluteRoot)) {
    throw new Error(`Invalid include path '${includePath}': path escapes rootDir.`)
  }

  return resolvedIncludePath
}

const getExistingPathType = async (absolutePath: string): Promise<'file' | 'directory' | undefined> => {
  try {
    const entry = await stat(absolutePath)
    if (entry.isFile()) {
      return 'file'
    }
    if (entry.isDirectory()) {
      return 'directory'
    }
    return undefined
  } catch {
    return undefined
  }
}

const buildIncludeGlobPattern = ({
  absoluteRoot,
  absoluteIncludePath,
}: {
  absoluteRoot: string
  absoluteIncludePath: string
}) => {
  const relativeIncludePath = toPosix(relative(absoluteRoot, absoluteIncludePath))
  if (relativeIncludePath === '' || relativeIncludePath === '.') {
    return '**/*'
  }

  return `${relativeIncludePath.replace(/\/+$/, '')}/**/*`
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

    const validatedIncludePath = validateIncludePath({
      absoluteRoot,
      includePath: trimmed,
    })
    const includePathType = await getExistingPathType(validatedIncludePath)
    if (includePathType === 'file') {
      if (isSubPath(validatedIncludePath, absoluteRoot) && shouldIndexFile(validatedIncludePath)) {
        files.add(resolve(validatedIncludePath))
      }
      continue
    }

    const glob = new Glob(
      buildIncludeGlobPattern({
        absoluteRoot,
        absoluteIncludePath: validatedIncludePath,
      }),
    )

    for await (const foundPath of glob.scan({ cwd: absoluteRoot, absolute: true })) {
      const absoluteFoundPath = resolve(foundPath)
      if (!isSubPath(absoluteFoundPath, absoluteRoot)) {
        continue
      }

      if (!shouldIndexFile(absoluteFoundPath)) {
        continue
      }

      files.add(absoluteFoundPath)
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

type SkillIndexEntry = {
  name: string
  description: string
  license: string | null
  compatibility: string | null
}

const getStringRecordField = (record: Record<string, unknown> | undefined, key: string): string | undefined => {
  if (!record) {
    return undefined
  }

  const value = record[key]
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

const loadSkillIndex = async ({ rootDir }: { rootDir: string }): Promise<Map<string, SkillIndexEntry>> => {
  const skillIndex = new Map<string, SkillIndexEntry>()
  const [skillDirectories, skillCatalog] = await Promise.all([findSkillDirectories(rootDir), loadSkillCatalog(rootDir)])
  const catalogByPath = new Map(skillCatalog.catalog.map((entry) => [entry.path, entry]))

  for (const skillDirectory of skillDirectories) {
    const relativeSkillDirectory = toPosix(relative(rootDir, skillDirectory))
    if (!relativeSkillDirectory || relativeSkillDirectory === '.' || relativeSkillDirectory.startsWith('../')) {
      continue
    }

    const relativeSkillPath = toPosix(join(relativeSkillDirectory, 'SKILL.md'))
    const catalogEntry = catalogByPath.get(`/${relativeSkillPath}`)
    if (!catalogEntry) {
      continue
    }

    const [frontmatter, instructions, linkValidation] = await Promise.all([
      loadSkillFrontmatter(rootDir, relativeSkillDirectory),
      loadSkillInstructions(rootDir, relativeSkillDirectory),
      getSkillInstructionResourceLinks(rootDir, relativeSkillDirectory),
    ])
    if (!instructions) {
      continue
    }
    if (!linkValidation || linkValidation.errors.length > 0) {
      continue
    }

    skillIndex.set(relativeSkillPath, {
      name: getStringRecordField(frontmatter, 'name') ?? catalogEntry.name,
      description: getStringRecordField(frontmatter, 'description') ?? catalogEntry.description,
      license: getStringRecordField(frontmatter, 'license') ?? null,
      compatibility: getStringRecordField(frontmatter, 'compatibility') ?? null,
    })
  }

  return skillIndex
}

const toAgentInstructionScopePath = (relativePath: string): string => {
  const normalizedPath = toPosix(relativePath)
  if (normalizedPath === 'AGENTS.md') {
    return '.'
  }

  const directory = toPosix(dirname(normalizedPath))
  return directory === '.' ? '.' : directory
}

const inferDocTitle = (relativePath: string): string => {
  const stem = basename(relativePath, extname(relativePath))
  const words = stem
    .replace(/[-_]+/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0)

  if (words.length === 0) {
    return stem || relativePath
  }

  return words.map((word) => `${word[0]?.toUpperCase() ?? ''}${word.slice(1)}`).join(' ')
}

const parseMarkdownHeadings = (markdown: string): DocHeadingRow[] => {
  const headings: DocHeadingRow[] = []
  const lines = markdown.split(/\r?\n/)
  let insideFence = false
  let orderIndex = 0

  for (const [index, rawLine] of lines.entries()) {
    const line = rawLine.trim()
    if (line.startsWith('```') || line.startsWith('~~~')) {
      insideFence = !insideFence
      continue
    }
    if (insideFence) {
      continue
    }

    const match = rawLine.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/)
    if (!match) {
      continue
    }

    const hashes = match[1]
    const heading = match[2]?.trim()
    if (!hashes || !heading) {
      continue
    }

    headings.push({
      heading,
      level: hashes.length,
      line: index + 1,
      orderIndex,
    })
    orderIndex += 1
  }

  return headings
}

const parseDocTitle = (markdown: string): string | undefined => {
  const heading = parseMarkdownHeadings(markdown)[0]
  return heading?.heading
}

const sortLocalMarkdownLinks = (left: LocalMarkdownLink, right: LocalMarkdownLink): number => {
  const valueComparison = left.value.localeCompare(right.value)
  if (valueComparison !== 0) {
    return valueComparison
  }
  return left.text.localeCompare(right.text)
}

const parseDocLinks = async ({
  markdownBody,
  absolutePath,
  absoluteRoot,
}: {
  markdownBody: string
  absolutePath: string
  absoluteRoot: string
}): Promise<DocLinkRow[]> => {
  const baseDir = dirname(absolutePath)
  const validation = await validateMarkdownLocalLinks({
    baseDir,
    markdownBody,
  })
  const present = [...validation.present].sort(sortLocalMarkdownLinks)
  const missing = [...validation.missing].sort(sortLocalMarkdownLinks)
  const rows: DocLinkRow[] = []

  for (const link of present) {
    const absoluteTargetPath = resolve(baseDir, link.value)
    const normalizedTargetPath = isSubPath(absoluteTargetPath, absoluteRoot)
      ? toPosix(relative(absoluteRoot, absoluteTargetPath))
      : null
    rows.push({
      value: link.value,
      text: link.text,
      targetPath: normalizedTargetPath,
      targetExists: true,
    })
  }

  for (const link of missing) {
    const absoluteTargetPath = resolve(baseDir, link.value)
    const normalizedTargetPath = isSubPath(absoluteTargetPath, absoluteRoot)
      ? toPosix(relative(absoluteRoot, absoluteTargetPath))
      : null
    rows.push({
      value: link.value,
      text: link.text,
      targetPath: normalizedTargetPath,
      targetExists: false,
    })
  }

  return rows
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
  wikiIndexed: number
}> => {
  if (force) {
    db.exec('DELETE FROM symbols;')
    db.exec('DELETE FROM imports;')
    db.exec('DELETE FROM exports;')
    db.exec('DELETE FROM agent_instructions;')
    db.exec('DELETE FROM skills;')
    db.exec('DELETE FROM docs;')
    db.exec('DELETE FROM files;')
  }

  const absoluteRoot = resolve(rootDir)
  const [files, skillIndex] = await Promise.all([
    collectFilesForIndexing({ rootDir: absoluteRoot, include }),
    loadSkillIndex({ rootDir: absoluteRoot }),
  ])

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
  const deleteFileAgentInstructions = db.query('DELETE FROM agent_instructions WHERE path = ?')
  const deleteFileSkill = db.query('DELETE FROM skills WHERE path = ?')
  const deleteFileDoc = db.query('DELETE FROM docs WHERE path = ?')
  const deleteFileDocHeadings = db.query('DELETE FROM doc_headings WHERE path = ?')
  const deleteFileDocLinks = db.query('DELETE FROM doc_links WHERE path = ?')

  const insertSymbol = db.query('INSERT INTO symbols (file_path, name, kind, line) VALUES (?, ?, ?, ?)')
  const insertImport = db.query('INSERT INTO imports (file_path, specifier, line, is_type) VALUES (?, ?, ?, ?)')
  const insertExport = db.query('INSERT INTO exports (file_path, name, kind, line) VALUES (?, ?, ?, ?)')
  const insertDocHeading = db.query(
    'INSERT INTO doc_headings (path, heading, level, line, order_index, indexed_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
  const insertDocLink = db.query(
    `INSERT INTO doc_links (path, link_value, link_text, target_path, target_exists, indexed_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  )
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
  const upsertAgentInstruction = db.query(
    `INSERT INTO agent_instructions (path, scope_path, body, indexed_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(path) DO UPDATE SET
       scope_path = excluded.scope_path,
       body = excluded.body,
       indexed_at = excluded.indexed_at`,
  )

  let filesIndexed = 0
  let symbolsIndexed = 0
  let skillsIndexed = 0
  let wikiIndexed = 0
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
    deleteFileAgentInstructions.run(relativePath)
    deleteFileSkill.run(relativePath)
    deleteFileDoc.run(relativePath)
    deleteFileDocHeadings.run(relativePath)
    deleteFileDocLinks.run(relativePath)

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
      const skillMeta = skillIndex.get(relativePath)
      if (skillMeta) {
        upsertSkill.run(
          relativePath,
          skillMeta.name,
          skillMeta.description,
          skillMeta.license,
          skillMeta.compatibility,
          indexedAt,
        )
        skillsIndexed += 1
      }
    }

    if (kind === 'agent-instructions') {
      upsertAgentInstruction.run(relativePath, toAgentInstructionScopePath(relativePath), content, indexedAt)
    }

    if (kind === 'wiki') {
      const headings = parseMarkdownHeadings(content)
      const links = await parseDocLinks({
        markdownBody: content,
        absolutePath,
        absoluteRoot,
      })

      upsertDoc.run(relativePath, parseDocTitle(content) ?? inferDocTitle(relativePath), content, indexedAt)
      for (const heading of headings) {
        insertDocHeading.run(relativePath, heading.heading, heading.level, heading.line, heading.orderIndex, indexedAt)
      }

      for (const link of links) {
        insertDocLink.run(relativePath, link.value, link.text, link.targetPath, link.targetExists ? 1 : 0, indexedAt)
      }
      wikiIndexed += 1
    }

    filesIndexed += 1
  }

  return {
    filesIndexed,
    symbolsIndexed,
    skillsIndexed,
    wikiIndexed,
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

  const wikiRows = db
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
    ...wikiRows.map((row) => ({
      source: 'wiki' as const,
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
const normalizeRelativePath = (value: string): string => toPosix(value).replace(/^\.\//, '').replace(/\/+$/, '')
const pathScopesOverlap = (left: string, right: string): boolean =>
  left === right || left.startsWith(`${right}/`) || right.startsWith(`${left}/`)

const getRelevantAgentInstructionPaths = ({
  rows,
  paths,
}: {
  rows: Array<{ path: string; scope_path: string }>
  paths: string[]
}): string[] => {
  if (paths.length === 0) {
    return rows.map((row) => row.path)
  }

  const normalizedTaskPaths = paths.map((path) => normalizeRelativePath(path)).filter((path) => path.length > 0)
  return rows
    .filter((row) => {
      if (row.scope_path === '.') {
        return true
      }

      return normalizedTaskPaths.some((path) => pathScopesOverlap(path, normalizeRelativePath(row.scope_path)))
    })
    .map((row) => row.path)
}

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
  const skillPaths = new Set<string>()
  for (const term of searchTerms) {
    const likePattern = `%${escapeLike(term)}%`
    const matches = db
      .query(
        `SELECT name, path
         FROM skills
         WHERE name LIKE ? ESCAPE '\\' COLLATE NOCASE OR description LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY name ASC
         LIMIT 8`,
      )
      .all(likePattern, likePattern) as Array<{ name: string; path: string }>
    for (const match of matches) {
      skillRows.add(match.name)
      skillPaths.add(match.path)
    }
  }

  const agentInstructionRows = db
    .query(
      `SELECT path, scope_path
       FROM agent_instructions
       ORDER BY CASE scope_path WHEN '.' THEN 0 ELSE 1 END, LENGTH(scope_path) DESC, path ASC`,
    )
    .all() as Array<{ path: string; scope_path: string }>

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

  const normalizedTask = task.toLowerCase()
  const normalizedPaths = paths.map((path) => normalizeRelativePath(path))
  const modulePathInScope = normalizedPaths.some((path) => path === 'src/modules' || path.startsWith('src/modules/'))
  const moduleTaskHint =
    /module actor|module runtime|runtime actor|useextension|reportsnapshot|module diagnostics|mss/.test(normalizedTask)
  const isModuleActorReview = modulePathInScope || moduleTaskHint

  const commandsToRun = isModuleActorReview
    ? [
        'bun --bun tsc --noEmit',
        'bun test <targeted-files-or-surface>',
        `bun skills/plaited-context/scripts/module-patterns.ts '{"files":["<module-files>"]}'`,
        `bun skills/plaited-context/scripts/module-flow.ts '{"files":["<module-files>"],"format":"json"}'`,
        `bun skills/plaited-context/scripts/module-flow.ts '{"files":["<module-files>"],"format":"mermaid"}'`,
        `bun skills/typescript-lsp/scripts/run.ts '{"file":"<module-file>","operations":[{"type":"symbols"}]}'`,
        `bun skills/typescript-lsp/scripts/run.ts '{"file":"<module-file>","operations":[{"type":"references","line":<line>,"character":<character>}]}'`,
        `bun skills/typescript-lsp/scripts/run.ts '{"file":"<module-file>","operations":[{"type":"definition","line":<line>,"character":<character>}]}'`,
      ]
    : mode === 'review'
      ? ['bun --bun tsc --noEmit', 'bun test <targeted-files-or-surface>']
      : mode === 'docs'
        ? [
            `bun skills/plaited-context/scripts/scan.ts '{"rootDir":".","include":["AGENTS.md","docs","skills"]}'`,
            `bun skills/plaited-context/scripts/wiki-context.ts '{"task":"<docs-task>","paths":["docs"],"limit":10}'`,
          ]
        : [
            'bun --bun tsc --noEmit',
            'bun test <targeted-files-or-surface>',
            'bun skills/plaited-context/scripts/search.ts',
          ]

  const sourceOfTruth = unique([
    'src/ (code)',
    ...paths,
    ...getRelevantAgentInstructionPaths({ rows: agentInstructionRows, paths }),
    'AGENTS.md (operational instructions)',
    ...skillPaths,
    'skills/*/SKILL.md (operational skill instructions)',
    'docs/ (wiki/reference; lower authority than code, AGENTS.md, and skills)',
    'other indexed text (lowest authority)',
  ])

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
    authorityOrder: CONTEXT_AUTHORITY_ORDER,
    authorityPolicy: AUTHORITY_POLICY_TEXT,
    openQuestions,
  }
}

type WikiDocTableRow = {
  path: string
  title: string | null
  body: string
}

type WikiHeadingTableRow = {
  path: string
  heading: string
}

type WikiLinkTableRow = {
  path: string
  link_value: string
  link_text: string
  target_path: string | null
  target_exists: number
}

type SkillSearchRow = {
  name: string
  path: string
}

type AgentInstructionTableRow = {
  path: string
  scope_path: string
}

type WikiCleanupReport = {
  brokenLinks: WikiBrokenLink[]
  cleanupCandidates: WikiCleanupCandidate[]
  warningsByPath: Map<string, string[]>
  outboundByPath: Map<string, string[]>
}

const compareCleanupCandidates = (left: WikiCleanupCandidate, right: WikiCleanupCandidate): number => {
  const pathComparison = left.path.localeCompare(right.path)
  if (pathComparison !== 0) {
    return pathComparison
  }

  const kindComparison = left.kind.localeCompare(right.kind)
  if (kindComparison !== 0) {
    return kindComparison
  }

  return left.reason.localeCompare(right.reason)
}

const buildWikiCleanupReport = ({
  docsRows,
  linksRows,
  skillPaths,
}: {
  docsRows: WikiDocTableRow[]
  linksRows: WikiLinkTableRow[]
  skillPaths: Set<string>
}): WikiCleanupReport => {
  const docPaths = new Set(docsRows.map((row) => row.path))
  const brokenLinks: WikiBrokenLink[] = []
  const cleanupCandidates: WikiCleanupCandidate[] = []
  const cleanupCandidateKeys = new Set<string>()
  const warningsByPath = new Map<string, string[]>()
  const outboundByPath = new Map<string, Set<string>>()
  const incomingByPath = new Map<string, number>()

  for (const docPath of docPaths) {
    incomingByPath.set(docPath, 0)
    outboundByPath.set(docPath, new Set())
  }

  for (const row of linksRows) {
    const outboundSet = outboundByPath.get(row.path) ?? new Set<string>()
    outboundSet.add(row.target_path ?? row.link_value)
    outboundByPath.set(row.path, outboundSet)

    if (row.target_path && docPaths.has(row.target_path)) {
      incomingByPath.set(row.target_path, (incomingByPath.get(row.target_path) ?? 0) + 1)
    }

    if (row.target_exists === 1) {
      continue
    }

    const isMissingTarget = row.target_path !== null
    const reason = isMissingTarget
      ? `Local link target '${row.target_path}' does not exist.`
      : `Local link '${row.link_value}' cannot be resolved to a workspace path.`
    brokenLinks.push({
      path: row.path,
      linkValue: row.link_value,
      linkText: row.link_text,
      targetPath: row.target_path,
      reason,
      authority: 'wiki',
      provenance: ['doc-links'],
    })

    const kind: WikiCleanupCandidateKind = isMissingTarget ? 'missing-target-file' : 'broken-local-link'
    const candidateKey = `${row.path}:${kind}:${row.link_value}:${row.target_path ?? '<none>'}`
    if (cleanupCandidateKeys.has(candidateKey)) {
      continue
    }

    cleanupCandidateKeys.add(candidateKey)
    cleanupCandidates.push({
      path: row.path,
      kind,
      reason,
      authority: 'wiki',
      provenance: [
        `doc-links:${row.path}`,
        row.target_path ? `missing-target:${row.target_path}` : `link-value:${row.link_value}`,
      ],
    })
    warningsByPath.set(row.path, [...(warningsByPath.get(row.path) ?? []), reason])
  }

  for (const row of docsRows) {
    const outgoingCount = outboundByPath.get(row.path)?.size ?? 0
    const incomingCount = incomingByPath.get(row.path) ?? 0
    if (outgoingCount === 0 && incomingCount === 0) {
      const reason = 'Wiki page has no incoming or outgoing local links and may be orphaned.'
      cleanupCandidates.push({
        path: row.path,
        kind: 'orphan-page',
        reason,
        authority: 'wiki',
        provenance: ['doc-links:link-graph'],
      })
      warningsByPath.set(row.path, [...(warningsByPath.get(row.path) ?? []), reason])
    }
  }

  const skillPathPattern = /\bskills\/[A-Za-z0-9._-]+\/SKILL\.md\b/g
  for (const row of docsRows) {
    const mentionedSkillPaths = new Set<string>()
    for (const match of row.body.matchAll(skillPathPattern)) {
      const value = match[0]
      if (!value) {
        continue
      }
      mentionedSkillPaths.add(toPosix(value))
    }

    for (const skillPath of [...mentionedSkillPaths].sort((left, right) => left.localeCompare(right))) {
      if (skillPaths.has(skillPath)) {
        continue
      }

      const reason = `Referenced skill path '${skillPath}' is not indexed as an active skill.`
      const candidateKey = `${row.path}:retired-skill-reference:${skillPath}`
      if (cleanupCandidateKeys.has(candidateKey)) {
        continue
      }

      cleanupCandidateKeys.add(candidateKey)
      cleanupCandidates.push({
        path: row.path,
        kind: 'retired-skill-reference',
        reason,
        authority: 'wiki',
        provenance: [`doc-content:${skillPath}`],
      })
      warningsByPath.set(row.path, [...(warningsByPath.get(row.path) ?? []), reason])
    }
  }

  const normalizedOutboundByPath = new Map<string, string[]>()
  for (const [path, values] of outboundByPath.entries()) {
    normalizedOutboundByPath.set(
      path,
      [...values].sort((left, right) => left.localeCompare(right)),
    )
  }

  const normalizedWarningsByPath = new Map<string, string[]>()
  for (const [path, warnings] of warningsByPath.entries()) {
    normalizedWarningsByPath.set(
      path,
      [...new Set(warnings)].sort((left, right) => left.localeCompare(right)),
    )
  }

  brokenLinks.sort((left, right) => {
    const pathComparison = left.path.localeCompare(right.path)
    if (pathComparison !== 0) {
      return pathComparison
    }
    const valueComparison = left.linkValue.localeCompare(right.linkValue)
    if (valueComparison !== 0) {
      return valueComparison
    }
    return left.linkText.localeCompare(right.linkText)
  })
  cleanupCandidates.sort(compareCleanupCandidates)

  return {
    brokenLinks,
    cleanupCandidates,
    warningsByPath: normalizedWarningsByPath,
    outboundByPath: normalizedOutboundByPath,
  }
}

export const assembleWikiContext = ({
  db,
  task,
  paths,
  limit,
}: {
  db: Database
  task: string
  paths: string[]
  limit: number
}): WikiContextOutput => {
  const docsRows = db
    .query(
      `SELECT path, title, body
       FROM docs
       ORDER BY path ASC`,
    )
    .all() as WikiDocTableRow[]

  const headingsRows = db
    .query(
      `SELECT path, heading
       FROM doc_headings
       ORDER BY path ASC, order_index ASC`,
    )
    .all() as WikiHeadingTableRow[]

  const linksRows = db
    .query(
      `SELECT path, link_value, link_text, target_path, target_exists
       FROM doc_links
       ORDER BY path ASC, link_value ASC, link_text ASC`,
    )
    .all() as WikiLinkTableRow[]

  const skillPathRows = db
    .query(
      `SELECT path
       FROM files
       WHERE kind = 'skill'
       ORDER BY path ASC`,
    )
    .all() as Array<{ path: string }>
  const skillPaths = new Set(skillPathRows.map((row) => row.path))

  const cleanupReport = buildWikiCleanupReport({
    docsRows,
    linksRows,
    skillPaths,
  })

  const headingsByPath = new Map<string, string[]>()
  for (const row of headingsRows) {
    const headings = headingsByPath.get(row.path) ?? []
    headings.push(row.heading)
    headingsByPath.set(row.path, headings)
  }

  const terms = splitQueryTerms(task)
  const searchTerms = (terms.length > 0 ? terms : [task]).map((term) => term.toLowerCase())
  const normalizedTaskPaths = paths.map((path) => normalizeRelativePath(path)).filter((path) => path.length > 0)

  const scoredPages = docsRows
    .map((row) => {
      const title = row.title?.trim() || inferDocTitle(row.path)
      const headings = headingsByPath.get(row.path) ?? []
      const outboundReferences = cleanupReport.outboundByPath.get(row.path) ?? []
      const matchedTerms = new Set<string>()
      const matchedIn = new Set<WikiContextPage['provenance']['matchedIn'][number]>()
      let score = 0

      const normalizedPath = row.path.toLowerCase()
      const normalizedTitle = title.toLowerCase()
      const normalizedHeadings = headings.map((heading) => heading.toLowerCase())
      const normalizedBody = row.body.toLowerCase()
      const normalizedOutboundReferences = outboundReferences.map((reference) => reference.toLowerCase())

      for (const term of searchTerms) {
        if (normalizedPath.includes(term)) {
          matchedTerms.add(term)
          matchedIn.add('path')
          score += 3
        }
        if (normalizedTitle.includes(term)) {
          matchedTerms.add(term)
          matchedIn.add('title')
          score += 4
        }
        if (normalizedHeadings.some((heading) => heading.includes(term))) {
          matchedTerms.add(term)
          matchedIn.add('heading')
          score += 4
        }
        if (normalizedBody.includes(term)) {
          matchedTerms.add(term)
          matchedIn.add('body')
          score += 1
        }
        if (normalizedOutboundReferences.some((reference) => reference.includes(term))) {
          matchedTerms.add(term)
          matchedIn.add('outbound-link')
          score += 2
        }
      }

      for (const taskPath of normalizedTaskPaths) {
        if (pathScopesOverlap(row.path, taskPath)) {
          matchedIn.add('task-path')
          score += 2
        }

        if (outboundReferences.some((reference) => pathScopesOverlap(reference, taskPath))) {
          matchedIn.add('task-path')
          matchedIn.add('outbound-link')
          score += 5
        }
      }

      const warnings = cleanupReport.warningsByPath.get(row.path) ?? []
      if (warnings.length > 0) {
        score += 1
      }

      if (score === 0) {
        return null
      }

      const reasonFragments: string[] = []
      if (matchedIn.has('title') || matchedIn.has('heading')) {
        reasonFragments.push('matched title/headings')
      }
      if (matchedIn.has('path')) {
        reasonFragments.push('matched document path')
      }
      if (matchedIn.has('task-path')) {
        reasonFragments.push('linked to requested task paths')
      }
      if (matchedIn.has('body')) {
        reasonFragments.push('matched body terms')
      }
      if (warnings.length > 0) {
        reasonFragments.push('contains cleanup warnings')
      }

      return {
        page: {
          path: row.path,
          title,
          reason: reasonFragments.join('; ') || 'matched wiki relevance terms',
          authority: 'wiki' as const,
          headings,
          outboundLocalReferences: outboundReferences,
          warnings,
          provenance: {
            matchedTerms: [...matchedTerms].sort((left, right) => left.localeCompare(right)),
            matchedIn: [...matchedIn].sort((left, right) => left.localeCompare(right)),
          },
        },
        score,
      }
    })
    .filter((entry): entry is { page: WikiContextPage; score: number } => entry !== null)
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score
      }
      return left.page.path.localeCompare(right.page.path)
    })

  const agentInstructionRows = db
    .query(
      `SELECT path, scope_path
       FROM agent_instructions
       ORDER BY CASE scope_path WHEN '.' THEN 0 ELSE 1 END, LENGTH(scope_path) DESC, path ASC`,
    )
    .all() as AgentInstructionTableRow[]
  const relevantAgentInstructionPaths = new Set(getRelevantAgentInstructionPaths({ rows: agentInstructionRows, paths }))
  const agentInstructions: WikiContextAgentInstruction[] = agentInstructionRows
    .filter((row) => relevantAgentInstructionPaths.has(row.path))
    .map((row) => ({
      path: row.path,
      scopePath: row.scope_path,
      authority: 'agent-instructions',
      reason:
        row.scope_path === '.'
          ? 'Root AGENTS.md applies across the workspace.'
          : normalizedTaskPaths.length > 0
            ? 'AGENTS scope overlaps requested paths.'
            : 'Scoped AGENTS instruction included.',
      provenance: [`scope:${row.scope_path}`],
    }))

  const skillMatchByPath = new Map<string, { name: string; path: string; matchedTerms: Set<string> }>()
  for (const term of searchTerms) {
    const likePattern = `%${escapeLike(term)}%`
    const matches = db
      .query(
        `SELECT name, path
         FROM skills
         WHERE name LIKE ? ESCAPE '\\' COLLATE NOCASE OR description LIKE ? ESCAPE '\\' COLLATE NOCASE
         ORDER BY name ASC
         LIMIT 24`,
      )
      .all(likePattern, likePattern) as SkillSearchRow[]

    for (const match of matches) {
      const existing = skillMatchByPath.get(match.path)
      if (existing) {
        existing.matchedTerms.add(term)
        continue
      }

      skillMatchByPath.set(match.path, {
        name: match.name,
        path: match.path,
        matchedTerms: new Set([term]),
      })
    }
  }

  const skills = [...skillMatchByPath.values()]
    .sort((left, right) => left.name.localeCompare(right.name) || left.path.localeCompare(right.path))
    .map(
      (entry): WikiContextSkill => ({
        name: entry.name,
        path: entry.path,
        authority: 'skill',
        reason: 'skill metadata matched task terms',
        provenance: [...entry.matchedTerms].sort((left, right) => left.localeCompare(right)),
      }),
    )
    .slice(0, Math.max(limit, 1))

  const wikiPages = scoredPages.slice(0, Math.max(limit, 1)).map((entry) => entry.page)
  const openQuestions: string[] = []
  if (wikiPages.length === 0) {
    openQuestions.push('No wiki pages matched the task terms. Confirm whether docs/ should be included in scan inputs.')
  }
  if (cleanupReport.cleanupCandidates.length > 0) {
    openQuestions.push(
      `${cleanupReport.cleanupCandidates.length} wiki cleanup candidates were found; review before relying on wiki assertions.`,
    )
  }

  return {
    ok: true,
    wikiPages,
    agentInstructions,
    skills,
    sourceOfTruth: CONTEXT_AUTHORITY_ORDER,
    authorityPolicy: AUTHORITY_POLICY_TEXT,
    brokenLinks: cleanupReport.brokenLinks,
    cleanupCandidates: cleanupReport.cleanupCandidates,
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
  wikiTask,
  wikiPaths,
  wikiLimit,
}: {
  db: Database
  statuses: FindingStatus[]
  wikiTask: string
  wikiPaths: string[]
  wikiLimit: number
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
  wikiContext: WikiContextOutput
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

  const wikiContext = assembleWikiContext({
    db,
    task: wikiTask,
    paths: wikiPaths,
    limit: wikiLimit,
  })

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
    wikiContext,
  }
}
