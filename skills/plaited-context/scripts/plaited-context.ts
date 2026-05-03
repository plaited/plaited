import { Database } from 'bun:sqlite'
import { mkdir } from 'node:fs/promises'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import * as z from 'zod'

const DEFAULT_DB_RELATIVE_PATH = '.plaited/context.sqlite'
const SCHEMA_SQL_PATH = resolve(import.meta.dir, '../assets/schema.sql')

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

let cachedSchemaSql: string | undefined

const nowIso = () => new Date().toISOString()

const isInsideNodeModules = (value: string) => value.replace(/\\/g, '/').includes('/node_modules/')

const stripNodeModulesPrefix = (value: string): string | undefined => {
  const normalized = resolve(value).replace(/\\/g, '/')
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

const readPackageName = async (directory: string): Promise<string | undefined> => {
  const packageJsonFile = Bun.file(join(directory, 'package.json'))
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

const isPlaitedSourceRoot = async (directory: string): Promise<boolean> => {
  return (await readPackageName(directory)) === 'plaited'
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

  const detectedRepoRoot = await findUpward({
    start: cwd,
    predicate: isPlaitedSourceRoot,
  })

  const scriptPackageRoot = resolve(import.meta.dir, '../../..')
  const inferredPackageRoot = isInsideNodeModules(scriptPackageRoot) ? scriptPackageRoot : undefined

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

    return {
      findingId,
      evidenceCount: finding.evidence.length,
    }
  })

  return transaction()
}
