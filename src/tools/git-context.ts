/**
 * Git context MCP tools for agent use.
 *
 * Registers four tools: `git_status`, `git_history`, `git_worktrees`, and
 * `git_context`. Returns structured JSON instead of raw git output so agents
 * can consume results directly without parsing.
 */

import { stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import * as z from 'zod'
import { useMCPServer } from './use-mcp-server.ts'

const GIT_MODES = {
  status: 'status',
  history: 'history',
  worktrees: 'worktrees',
  context: 'context',
} as const

const DEFAULT_HISTORY_LIMIT = 20
const MAX_HISTORY_LIMIT = 200
const MAX_FILE_LIST_ENTRIES = 200
const BROAD_CHANGED_FILE_THRESHOLD = 80
const BROAD_COMMIT_THRESHOLD = 40

// ============================================================================
// Types
// ============================================================================

type GitResult = {
  stdout: string
  stderr: string
  exitCode: number
}

type WorktreeAccumulator = {
  path: string
  head: string
  branch: string | null
  detached: boolean
  bare: boolean
  lockedReason: string | null
  prunableReason: string | null
}

type GitChangedFile = {
  status: 'A' | 'C' | 'D' | 'M' | 'R' | 'T' | 'U' | 'X'
  rawStatus: string
  path: string
  oldPath?: string
}

type GitCommit = {
  fullSha: string
  shortSha: string
  committedAt: string
  subject: string
}

type GitPathHistoryEntry = {
  path: string
  commits: GitCommit[]
}

type GitWorktreeEntry = {
  path: string
  head: string
  branch: string | null
  detached: boolean
  bare: boolean
  lockedReason: string | null
  prunableReason: string | null
  exists: boolean
  isCurrent: boolean
}

// ============================================================================
// Class
// ============================================================================
class GitCommandError extends Error {
  readonly command: string
  readonly exitCode: number
  readonly stderr: string

  constructor({ command, exitCode, stderr }: { command: string; exitCode: number; stderr: string }) {
    super(`Git command failed (${exitCode}): ${command}`)
    this.command = command
    this.exitCode = exitCode
    this.stderr = stderr
  }
}

// ============================================================================
// Schemas
// ============================================================================

const _GitStatusInputSchema = z
  .object({
    mode: z.literal(GIT_MODES.status),
    cwd: z.string().min(1).optional(),
  })
  .strict()

const _GitHistoryInputSchema = z
  .object({
    mode: z.literal(GIT_MODES.history),
    cwd: z.string().min(1).optional(),
    base: z.string().min(1),
    paths: z.array(z.string().min(1)).default([]),
    limit: z.number().int().positive().max(MAX_HISTORY_LIMIT).default(DEFAULT_HISTORY_LIMIT),
  })
  .strict()

const _GitWorktreesInputSchema = z
  .object({
    mode: z.literal(GIT_MODES.worktrees),
    cwd: z.string().min(1).optional(),
  })
  .strict()

const GitContextInputSchema = z
  .object({
    mode: z.literal(GIT_MODES.context),
    cwd: z.string().min(1).optional(),
    base: z.string().min(1),
    paths: z.array(z.string().min(1)).default([]),
    limit: z.number().int().positive().max(MAX_HISTORY_LIMIT).default(DEFAULT_HISTORY_LIMIT),
    includeWorktrees: z.boolean().default(false),
  })
  .strict()

const GitChangedFileSchema = z.object({
  status: z.enum(['A', 'C', 'D', 'M', 'R', 'T', 'U', 'X']),
  rawStatus: z.string().min(1),
  path: z.string().min(1),
  oldPath: z.string().min(1).optional(),
})

const GitCommitSchema = z.object({
  fullSha: z.string().min(1),
  shortSha: z.string().min(1),
  committedAt: z.string().min(1),
  subject: z.string().min(1),
})

const GitPathHistoryEntrySchema = z.object({
  path: z.string().min(1),
  commits: z.array(GitCommitSchema),
})

const GitWorktreeEntrySchema = z.object({
  path: z.string().min(1),
  head: z.string().min(1),
  branch: z.string().nullable(),
  detached: z.boolean(),
  bare: z.boolean(),
  lockedReason: z.string().nullable(),
  prunableReason: z.string().nullable(),
  exists: z.boolean(),
  isCurrent: z.boolean(),
})

const GitDirtySummarySchema = z.object({
  isDirty: z.boolean(),
  stagedCount: z.number().int().nonnegative(),
  unstagedCount: z.number().int().nonnegative(),
  untrackedCount: z.number().int().nonnegative(),
  stagedFiles: z.array(z.string()),
  unstagedFiles: z.array(z.string()),
  untrackedFiles: z.array(z.string()),
})

const GitStatusOutputSchema = z.object({
  ok: z.literal(true),
  mode: z.literal(GIT_MODES.status),
  repoRoot: z.string().min(1),
  branch: z.string().nullable(),
  head: z.string().min(1),
  upstream: z.string().nullable(),
  dirty: GitDirtySummarySchema,
  warnings: z.array(z.string()),
  suggestedNextCommands: z.array(z.string()),
})

const GitHistorySummarySchema = z.object({
  commitCountSinceBase: z.number().int().nonnegative(),
  changedFileCountSinceBase: z.number().int().nonnegative(),
  deletedFileCountSinceBase: z.number().int().nonnegative(),
})

const GitHistoryOutputSchema = z.object({
  ok: z.literal(true),
  mode: z.literal(GIT_MODES.history),
  repoRoot: z.string().min(1),
  base: z.string().min(1),
  baseHead: z.string().nullable(),
  mergeBase: z.string().nullable(),
  paths: z.array(z.string()),
  commitsSinceBase: z.array(GitCommitSchema),
  changedFilesSinceBase: z.array(GitChangedFileSchema),
  pathHistory: z.array(GitPathHistoryEntrySchema),
  summary: GitHistorySummarySchema,
  warnings: z.array(z.string()),
  suggestedNextCommands: z.array(z.string()),
})

const GitWorktreesOutputSchema = z.object({
  ok: z.literal(true),
  mode: z.literal(GIT_MODES.worktrees),
  repoRoot: z.string().min(1),
  currentWorktree: z.string().min(1),
  worktrees: z.array(GitWorktreeEntrySchema),
  warnings: z.array(z.string()),
  suggestedNextCommands: z.array(z.string()),
})

const GitContextSummarySchema = z.object({
  commitCountSinceBase: z.number().int().nonnegative(),
  changedFileCountSinceBase: z.number().int().nonnegative(),
  deletedFileCountSinceBase: z.number().int().nonnegative(),
  worktreeCount: z.number().int().nonnegative(),
})

const GitContextOutputSchema = z.object({
  ok: z.literal(true),
  mode: z.literal(GIT_MODES.context),
  repoRoot: z.string().min(1),
  branch: z.string().nullable(),
  head: z.string().min(1),
  upstream: z.string().nullable(),
  base: z.string().min(1),
  baseHead: z.string().nullable(),
  mergeBase: z.string().nullable(),
  dirty: GitDirtySummarySchema,
  commitsSinceBase: z.array(GitCommitSchema),
  changedFilesSinceBase: z.array(GitChangedFileSchema),
  pathHistory: z.array(GitPathHistoryEntrySchema),
  worktrees: z.array(GitWorktreeEntrySchema),
  summary: GitContextSummarySchema,
  warnings: z.array(z.string()),
  suggestedNextCommands: z.array(z.string()),
})

// ============================================================================
// Helpers
// ============================================================================

const toPosix = (value: string): string => value.replace(/\\/g, '/')

const quoteArg = (value: string): string => {
  if (value === '') return "''"
  if (/^[A-Za-z0-9_./:@=+-]+$/.test(value)) return value
  return `'${value.replaceAll("'", "'\\''")}'`
}

const formatCommand = (argv: string[]): string => argv.map((arg) => quoteArg(arg)).join(' ')

const formatGitCommand = (args: string[]): string => formatCommand(['git', ...args])

const unique = (items: string[]): string[] => [...new Set(items)]

const isPathWithinRoot = ({ candidate, rootPath }: { candidate: string; rootPath: string }): boolean => {
  const relativePath = relative(rootPath, candidate)
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

const toRepoPath = ({ repoRoot, absolutePath }: { repoRoot: string; absolutePath: string }): string => {
  if (!isPathWithinRoot({ candidate: absolutePath, rootPath: repoRoot })) {
    return absolutePath
  }

  const relativePath = toPosix(relative(repoRoot, absolutePath))
  return relativePath === '' ? '.' : relativePath
}

const resolvePathWithinRepo = ({ repoRoot, value }: { repoRoot: string; value: string }): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`Invalid path '${value}': empty paths are not allowed.`)
  }

  const absolutePath = isAbsolute(trimmed) ? resolve(trimmed) : resolve(repoRoot, trimmed)
  if (!isPathWithinRoot({ candidate: absolutePath, rootPath: repoRoot })) {
    throw new Error(`Invalid path '${value}': path escapes repository root.`)
  }

  return toRepoPath({ repoRoot, absolutePath })
}

const resolvePathListWithinRepo = ({ repoRoot, paths }: { repoRoot: string; paths: string[] }): string[] => {
  const entries = new Set<string>()
  for (const path of paths) {
    entries.add(resolvePathWithinRepo({ repoRoot, value: path }))
  }

  return [...entries]
}

const runGit = async ({
  cwd,
  args,
  allowFailure = false,
}: {
  cwd: string
  args: string[]
  allowFailure?: boolean
}): Promise<GitResult> => {
  const result = await Bun.$`git ${args}`.cwd(cwd).quiet().nothrow()
  const stdout = result.stdout.toString().trimEnd()
  const stderr = result.stderr.toString().trim()

  if (result.exitCode !== 0 && !allowFailure) {
    throw new GitCommandError({
      command: formatGitCommand(args),
      exitCode: result.exitCode,
      stderr,
    })
  }

  return {
    stdout,
    stderr,
    exitCode: result.exitCode,
  }
}

const resolveGitRepoRoot = async (cwd: string): Promise<string> => {
  const result = await runGit({
    cwd,
    args: ['rev-parse', '--show-toplevel'],
  })

  return resolve(result.stdout.trim())
}

const resolveCurrentBranch = async ({ cwd }: { cwd: string }): Promise<string | null> => {
  const result = await runGit({
    cwd,
    args: ['branch', '--show-current'],
  })

  const branch = result.stdout.trim()
  return branch ? branch : null
}

const resolveHead = async ({ cwd }: { cwd: string }): Promise<string> => {
  const result = await runGit({
    cwd,
    args: ['rev-parse', 'HEAD'],
  })

  return result.stdout.trim()
}

const resolveUpstream = async ({ cwd }: { cwd: string }): Promise<string | null> => {
  const result = await runGit({
    cwd,
    args: ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
    allowFailure: true,
  })

  if (result.exitCode !== 0) {
    return null
  }

  const upstream = result.stdout.trim()
  return upstream ? upstream : null
}

const resolveGitRef = async ({ cwd, ref }: { cwd: string; ref: string }): Promise<string | null> => {
  const result = await runGit({
    cwd,
    args: ['rev-parse', '--verify', `${ref}^{commit}`],
    allowFailure: true,
  })

  if (result.exitCode !== 0) {
    return null
  }

  return result.stdout.trim()
}

const resolveMergeBase = async ({ cwd, baseRef }: { cwd: string; baseRef: string }): Promise<string | null> => {
  const result = await runGit({
    cwd,
    args: ['merge-base', 'HEAD', baseRef],
    allowFailure: true,
  })

  if (result.exitCode !== 0) {
    return null
  }

  return result.stdout.trim()
}

const parseGitLogRows = (stdout: string): GitCommit[] => {
  if (!stdout.trim()) {
    return []
  }

  const commits: GitCommit[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) continue

    const [fullSha = '', shortSha = '', committedAt = '', ...subjectParts] = trimmed.split('\t')
    const subject = subjectParts.join('\t').trim()
    if (!fullSha || !shortSha || !committedAt || !subject) {
      continue
    }

    commits.push({
      fullSha,
      shortSha,
      committedAt,
      subject,
    })
  }

  return commits
}

const parseNameStatusRows = ({ stdout, repoRoot }: { stdout: string; repoRoot: string }): GitChangedFile[] => {
  if (!stdout.trim()) {
    return []
  }

  const rows: GitChangedFile[] = []

  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    const parts = line.split('\t')
    const rawStatus = parts[0]?.trim() ?? ''
    const normalizedStatus = rawStatus[0] as GitChangedFile['status'] | undefined
    if (!rawStatus || !normalizedStatus || !['A', 'C', 'D', 'M', 'R', 'T', 'U', 'X'].includes(normalizedStatus)) {
      continue
    }

    if ((normalizedStatus === 'R' || normalizedStatus === 'C') && parts.length >= 3) {
      const oldPathRaw = parts[1]?.trim()
      const pathRaw = parts[2]?.trim()
      if (!oldPathRaw || !pathRaw) {
        continue
      }

      rows.push({
        status: normalizedStatus,
        rawStatus,
        path: resolvePathWithinRepo({ repoRoot, value: pathRaw }),
        oldPath: resolvePathWithinRepo({ repoRoot, value: oldPathRaw }),
      })
      continue
    }

    const pathRaw = parts[1]?.trim()
    if (!pathRaw) {
      continue
    }

    rows.push({
      status: normalizedStatus,
      rawStatus,
      path: resolvePathWithinRepo({ repoRoot, value: pathRaw }),
    })
  }

  return rows
}

const collectCommits = async ({
  cwd,
  range,
  limit,
}: {
  cwd: string
  range: string
  limit: number
}): Promise<GitCommit[]> => {
  const result = await runGit({
    cwd,
    args: ['log', '--no-decorate', '--date=iso-strict', '--pretty=format:%H%x09%h%x09%cI%x09%s', `-n${limit}`, range],
  })

  return parseGitLogRows(result.stdout)
}

const collectPathHistory = async ({
  cwd,
  paths,
  limit,
}: {
  cwd: string
  paths: string[]
  limit: number
}): Promise<GitPathHistoryEntry[]> => {
  const rows: GitPathHistoryEntry[] = []
  for (const path of paths) {
    const result = await runGit({
      cwd,
      args: [
        'log',
        '--no-decorate',
        '--date=iso-strict',
        '--pretty=format:%H%x09%h%x09%cI%x09%s',
        `-n${limit}`,
        '--',
        path,
      ],
    })

    rows.push({
      path,
      commits: parseGitLogRows(result.stdout),
    })
  }

  return rows
}

const collectChangedFiles = async ({
  cwd,
  mergeBase,
  repoRoot,
}: {
  cwd: string
  mergeBase: string
  repoRoot: string
}): Promise<GitChangedFile[]> => {
  const result = await runGit({
    cwd,
    args: ['diff', '--name-status', `${mergeBase}...HEAD`],
  })

  return parseNameStatusRows({ stdout: result.stdout, repoRoot })
}

const parseStatusPath = (rawPath: string): string => {
  const path = rawPath.includes(' -> ') ? (rawPath.split(' -> ').at(-1)?.trim() ?? rawPath) : rawPath
  return path
}

const collectDirtyState = async ({
  cwd,
  repoRoot,
}: {
  cwd: string
  repoRoot: string
}): Promise<{
  stagedFiles: string[]
  unstagedFiles: string[]
  untrackedFiles: string[]
}> => {
  const args = ['status', '--porcelain=v1', '-z', '--branch', '--untracked-files=all']
  const command = formatGitCommand(args)
  const process = Bun.spawn(['git', ...args], {
    cwd,
    stdout: 'pipe',
    stderr: 'pipe',
  })
  const [stdoutBuffer, stderrText, exitCode] = await Promise.all([
    new Response(process.stdout).arrayBuffer(),
    new Response(process.stderr).text(),
    process.exited,
  ])
  if (exitCode !== 0) {
    throw new GitCommandError({
      command,
      exitCode,
      stderr: stderrText.trim(),
    })
  }

  const stagedFiles = new Set<string>()
  const unstagedFiles = new Set<string>()
  const untrackedFiles = new Set<string>()

  const records = new TextDecoder().decode(stdoutBuffer).split('\u0000')
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index]
    if (!record || record.startsWith('## ')) {
      continue
    }

    if (record.startsWith('?? ')) {
      const path = record.slice(3)
      if (path) {
        untrackedFiles.add(resolvePathWithinRepo({ repoRoot, value: parseStatusPath(path) }))
      }
      continue
    }

    if (record.startsWith('!! ')) {
      continue
    }

    const x = record[0] ?? ' '
    const y = record[1] ?? ' '
    const rawPath = record.slice(3)
    if (!rawPath) {
      continue
    }

    const path = resolvePathWithinRepo({ repoRoot, value: parseStatusPath(rawPath) })
    if (x !== ' ') {
      stagedFiles.add(path)
    }
    if (y !== ' ') {
      unstagedFiles.add(path)
    }

    if (x === 'R' || x === 'C' || y === 'R' || y === 'C') {
      index += 1
    }
  }

  return {
    stagedFiles: [...stagedFiles].sort(),
    unstagedFiles: [...unstagedFiles].sort(),
    untrackedFiles: [...untrackedFiles].sort(),
  }
}

const pathExists = async (value: string): Promise<boolean> => {
  try {
    await stat(value)
    return true
  } catch {
    return false
  }
}

const createWorktreeAccumulator = (path: string): WorktreeAccumulator => ({
  path,
  head: '',
  branch: null,
  detached: false,
  bare: false,
  lockedReason: null,
  prunableReason: null,
})

const parseWorktreeList = (stdout: string): WorktreeAccumulator[] => {
  const rows: WorktreeAccumulator[] = []
  let current: WorktreeAccumulator | null = null

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }

    if (line.startsWith('worktree ')) {
      if (current) {
        rows.push(current)
      }
      current = createWorktreeAccumulator(line.slice('worktree '.length))
      continue
    }

    if (!current) {
      continue
    }

    if (line.startsWith('HEAD ')) {
      current.head = line.slice('HEAD '.length).trim()
      continue
    }
    if (line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).trim()
      continue
    }
    if (line === 'detached') {
      current.detached = true
      continue
    }
    if (line === 'bare') {
      current.bare = true
      continue
    }
    if (line === 'locked') {
      current.lockedReason = ''
      continue
    }
    if (line.startsWith('locked ')) {
      current.lockedReason = line.slice('locked '.length)
      continue
    }
    if (line === 'prunable') {
      current.prunableReason = ''
      continue
    }
    if (line.startsWith('prunable ')) {
      current.prunableReason = line.slice('prunable '.length)
    }
  }

  if (current) {
    rows.push(current)
  }

  return rows
}

const collectWorktrees = async ({
  cwd,
  repoRoot,
  currentWorktree,
}: {
  cwd: string
  repoRoot: string
  currentWorktree: string
}): Promise<GitWorktreeEntry[]> => {
  const result = await runGit({
    cwd,
    args: ['worktree', 'list', '--porcelain'],
  })

  const parsed = parseWorktreeList(result.stdout)
  const entries: GitWorktreeEntry[] = []

  for (const row of parsed) {
    const absolutePath = resolve(row.path)

    entries.push({
      path: toRepoPath({ repoRoot, absolutePath }),
      head: row.head,
      branch: row.branch,
      detached: row.detached,
      bare: row.bare,
      lockedReason: row.lockedReason,
      prunableReason: row.prunableReason,
      exists: await pathExists(absolutePath),
      isCurrent: absolutePath === currentWorktree,
    })
  }

  return entries
}

const capList = <T>({ entries, label, warnings }: { entries: T[]; label: string; warnings: string[] }): T[] => {
  if (entries.length <= MAX_FILE_LIST_ENTRIES) {
    return entries
  }

  warnings.push(`${label} list was truncated to ${MAX_FILE_LIST_ENTRIES} entries.`)
  return entries.slice(0, MAX_FILE_LIST_ENTRIES)
}

const collectStatus = async ({ cwd }: { cwd: string }): Promise<z.infer<typeof GitStatusOutputSchema>> => {
  const repoRoot = await resolveGitRepoRoot(cwd)
  const [branch, head, upstream, dirtyState] = await Promise.all([
    resolveCurrentBranch({ cwd: repoRoot }),
    resolveHead({ cwd: repoRoot }),
    resolveUpstream({ cwd: repoRoot }),
    collectDirtyState({ cwd: repoRoot, repoRoot }),
  ])

  const warnings: string[] = []

  const stagedFiles = capList({ entries: dirtyState.stagedFiles, label: 'staged files', warnings })
  const unstagedFiles = capList({ entries: dirtyState.unstagedFiles, label: 'unstaged files', warnings })
  const untrackedFiles = capList({ entries: dirtyState.untrackedFiles, label: 'untracked files', warnings })

  const dirty = {
    isDirty:
      dirtyState.stagedFiles.length > 0 || dirtyState.unstagedFiles.length > 0 || dirtyState.untrackedFiles.length > 0,
    stagedCount: dirtyState.stagedFiles.length,
    unstagedCount: dirtyState.unstagedFiles.length,
    untrackedCount: dirtyState.untrackedFiles.length,
    stagedFiles,
    unstagedFiles,
    untrackedFiles,
  }

  if (dirty.isDirty) {
    warnings.push(
      `Dirty worktree detected: ${dirty.stagedCount} staged, ${dirty.unstagedCount} unstaged, ${dirty.untrackedCount} untracked.`,
    )
  }

  if (!upstream) {
    warnings.push('Current branch has no configured upstream tracking ref.')
  }

  return {
    ok: true,
    mode: GIT_MODES.status,
    repoRoot,
    branch,
    head,
    upstream,
    dirty,
    warnings,
    suggestedNextCommands: unique([
      formatGitCommand(['status', '--short', '--branch']),
      formatGitCommand(['diff', '--stat']),
      formatGitCommand(['log', '--oneline', '-20']),
    ]),
  }
}

const buildHistorySuggestedCommands = ({
  base,
  mergeBase,
  paths,
  limit,
}: {
  base: string
  mergeBase: string | null
  paths: string[]
  limit: number
}): string[] => {
  const commands: string[] = [
    formatGitCommand(['merge-base', 'HEAD', base]),
    formatGitCommand(['log', '--oneline', `-${limit}`]),
  ]

  if (mergeBase) {
    commands.push(formatGitCommand(['log', '--oneline', `-${limit}`, `${mergeBase}..HEAD`]))
    commands.push(formatGitCommand(['diff', '--stat', `${mergeBase}...HEAD`]))
    commands.push(formatGitCommand(['diff', '--name-status', `${mergeBase}...HEAD`]))
  } else {
    commands.push(formatGitCommand(['rev-parse', '--verify', `${base}^{commit}`]))
  }

  for (const path of paths) {
    commands.push(formatGitCommand(['log', '--oneline', `-${limit}`, '--', path]))
  }

  return unique(commands)
}

const collectHistory = async ({
  cwd,
  base,
  paths,
  limit,
}: {
  cwd: string
  base: string
  paths: string[]
  limit: number
}): Promise<z.infer<typeof GitHistoryOutputSchema>> => {
  const repoRoot = await resolveGitRepoRoot(cwd)
  const validatedPaths = resolvePathListWithinRepo({
    repoRoot,
    paths,
  })

  const warnings: string[] = []
  const baseHead = await resolveGitRef({ cwd: repoRoot, ref: base })

  if (!baseHead) {
    warnings.push(`Base ref '${base}' could not be resolved in this repository.`)
  }

  const mergeBase = baseHead
    ? await resolveMergeBase({
        cwd: repoRoot,
        baseRef: base,
      })
    : null

  if (baseHead && !mergeBase) {
    warnings.push(`Merge-base between HEAD and '${base}' could not be resolved.`)
  }

  const commitsSinceBase = mergeBase
    ? await collectCommits({
        cwd: repoRoot,
        range: `${mergeBase}..HEAD`,
        limit,
      })
    : []

  const changedFilesSinceBaseRaw = mergeBase
    ? await collectChangedFiles({
        cwd: repoRoot,
        mergeBase,
        repoRoot,
      })
    : []

  const changedFilesSinceBase = capList({
    entries: changedFilesSinceBaseRaw,
    label: 'changed files',
    warnings,
  })

  const pathHistory = await collectPathHistory({
    cwd: repoRoot,
    paths: validatedPaths,
    limit,
  })

  const deletedFileCountSinceBase = changedFilesSinceBaseRaw.filter((entry) => entry.status === 'D').length
  if (deletedFileCountSinceBase > 0) {
    warnings.push(`Branch includes ${deletedFileCountSinceBase} deleted file change(s) since merge-base.`)
  }

  if (changedFilesSinceBaseRaw.length > BROAD_CHANGED_FILE_THRESHOLD) {
    warnings.push(
      `Broad change surface: ${changedFilesSinceBaseRaw.length} changed files since merge-base (${BROAD_CHANGED_FILE_THRESHOLD}+).`,
    )
  }

  if (commitsSinceBase.length > BROAD_COMMIT_THRESHOLD) {
    warnings.push(
      `Broad commit range: ${commitsSinceBase.length} commits since merge-base (${BROAD_COMMIT_THRESHOLD}+).`,
    )
  }

  if (baseHead && mergeBase && baseHead !== mergeBase) {
    warnings.push(
      `Current branch merge-base (${mergeBase.slice(0, 12)}) differs from ${base} head (${baseHead.slice(0, 12)}).`,
    )
  }

  return {
    ok: true,
    mode: GIT_MODES.history,
    repoRoot,
    base,
    baseHead,
    mergeBase,
    paths: validatedPaths,
    commitsSinceBase,
    changedFilesSinceBase,
    pathHistory,
    summary: {
      commitCountSinceBase: commitsSinceBase.length,
      changedFileCountSinceBase: changedFilesSinceBaseRaw.length,
      deletedFileCountSinceBase,
    },
    warnings,
    suggestedNextCommands: buildHistorySuggestedCommands({
      base,
      mergeBase,
      paths: validatedPaths,
      limit,
    }),
  }
}

const collectWorktreeContext = async ({ cwd }: { cwd: string }): Promise<z.infer<typeof GitWorktreesOutputSchema>> => {
  const repoRoot = await resolveGitRepoRoot(cwd)
  const currentWorktree = repoRoot

  const worktrees = await collectWorktrees({
    cwd: repoRoot,
    repoRoot,
    currentWorktree,
  })

  const warnings: string[] = []
  for (const worktree of worktrees) {
    if (!worktree.exists) {
      warnings.push(`Worktree path is missing on disk: ${worktree.path}`)
    }
    if (worktree.prunableReason !== null) {
      warnings.push(`Worktree may be stale or prunable: ${worktree.path}`)
    }
  }

  return {
    ok: true,
    mode: GIT_MODES.worktrees,
    repoRoot,
    currentWorktree: toRepoPath({ repoRoot, absolutePath: currentWorktree }),
    worktrees,
    warnings,
    suggestedNextCommands: unique([
      formatGitCommand(['worktree', 'list', '--porcelain']),
      formatGitCommand(['branch', '--all', '--verbose']),
      formatGitCommand(['status', '--short', '--branch']),
    ]),
  }
}

const collectContext = async (
  input: z.infer<typeof GitContextInputSchema>,
): Promise<z.infer<typeof GitContextOutputSchema>> => {
  const cwd = resolve(input.cwd ?? process.cwd())

  const [status, history] = await Promise.all([
    collectStatus({ cwd }),
    collectHistory({
      cwd,
      base: input.base,
      paths: input.paths,
      limit: input.limit,
    }),
  ])
  const worktreeContext = input.includeWorktrees ? await collectWorktreeContext({ cwd }) : null

  return {
    ok: true,
    mode: GIT_MODES.context,
    repoRoot: history.repoRoot,
    branch: status.branch,
    head: status.head,
    upstream: status.upstream,
    base: history.base,
    baseHead: history.baseHead,
    mergeBase: history.mergeBase,
    dirty: status.dirty,
    commitsSinceBase: history.commitsSinceBase,
    changedFilesSinceBase: history.changedFilesSinceBase,
    pathHistory: history.pathHistory,
    worktrees: worktreeContext?.worktrees ?? [],
    summary: {
      commitCountSinceBase: history.summary.commitCountSinceBase,
      changedFileCountSinceBase: history.summary.changedFileCountSinceBase,
      deletedFileCountSinceBase: history.summary.deletedFileCountSinceBase,
      worktreeCount: worktreeContext?.worktrees.length ?? 0,
    },
    warnings: unique([...status.warnings, ...history.warnings, ...(worktreeContext?.warnings ?? [])]),
    suggestedNextCommands: unique([...status.suggestedNextCommands, ...history.suggestedNextCommands]),
  }
}

export const GIT_STATUS_TOOL_NAME = 'git_status'
export const gitStatus = useMCPServer((server) => {
  server.registerTool(
    GIT_STATUS_TOOL_NAME,
    {
      description: 'Branch, HEAD, upstream, staged/unstaged/untracked files',
      inputSchema: z.object({
        cwd: z.string().describe("the tool's provisioned cwd"),
      }),
      outputSchema: z.looseObject({
        ok: z.literal(true),
        mode: z.literal(GIT_MODES.status),
        repoRoot: z.string(),
        branch: z.string().nullable(),
        head: z.string(),
        upstream: z.string().nullable(),
        warnings: z.array(z.string()),
        message: z.string().optional().describe('error detail when isError'),
        isError: z.boolean().optional().describe('true when the operation failed'),
      }),
    },
    async ({ cwd }) => {
      try {
        const output = await collectStatus({ cwd })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (err) {
        const output = { message: `[Error: git status failed: ${(err as Error).message}]`, isError: true }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }
    },
  )
})

export const GIT_HISTORY_TOOL_NAME = 'git_history'
export const gitHistory = useMCPServer((server) => {
  server.registerTool(
    GIT_HISTORY_TOOL_NAME,
    {
      description: 'Merge-base, commits, changed files, per-path history',
      inputSchema: z.object({
        cwd: z.string().describe("the tool's provisioned cwd"),
        base: z.string().min(1).describe('base branch or ref to compare against'),
        paths: z.array(z.string()).optional().describe('specific file paths to get history for'),
        limit: z.number().int().positive().max(MAX_HISTORY_LIMIT).optional().describe('max commits to return'),
      }),
      outputSchema: z.looseObject({
        ok: z.literal(true),
        mode: z.literal(GIT_MODES.history),
        repoRoot: z.string(),
        base: z.string(),
        message: z.string().optional().describe('error detail when isError'),
        isError: z.boolean().optional().describe('true when the operation failed'),
      }),
    },
    async ({ cwd, base, paths, limit }) => {
      try {
        const output = await collectHistory({
          cwd,
          base,
          paths: paths ?? [],
          limit: limit ?? DEFAULT_HISTORY_LIMIT,
        })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (err) {
        const output = { message: `[Error: git history failed: ${(err as Error).message}]`, isError: true }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }
    },
  )
})

export const GIT_WORKTREES_TOOL_NAME = 'git_worktrees'
export const gitWorktrees = useMCPServer((server) => {
  server.registerTool(
    GIT_WORKTREES_TOOL_NAME,
    {
      description: 'Parsed worktree list with lock/prune metadata',
      inputSchema: z.object({
        cwd: z.string().describe("the tool's provisioned cwd"),
      }),
      outputSchema: z.looseObject({
        ok: z.literal(true),
        mode: z.literal(GIT_MODES.worktrees),
        repoRoot: z.string(),
        message: z.string().optional().describe('error detail when isError'),
        isError: z.boolean().optional().describe('true when the operation failed'),
      }),
    },
    async ({ cwd }) => {
      try {
        const output = await collectWorktreeContext({ cwd })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (err) {
        const output = { message: `[Error: git worktrees failed: ${(err as Error).message}]`, isError: true }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }
    },
  )
})

export const GIT_CONTEXT_TOOL_NAME = 'git_context'
export const gitContext = useMCPServer((server) => {
  server.registerTool(
    GIT_CONTEXT_TOOL_NAME,
    {
      description: 'Combined status + history + optional worktrees',
      inputSchema: z.object({
        cwd: z.string().describe("the tool's provisioned cwd"),
        base: z.string().min(1).describe('base branch or ref to compare against'),
        paths: z.array(z.string()).optional().describe('specific file paths to get history for'),
        limit: z.number().int().positive().max(MAX_HISTORY_LIMIT).optional().describe('max commits to return'),
        includeWorktrees: z.boolean().optional().describe('whether to include worktree info'),
      }),
      outputSchema: z.looseObject({
        ok: z.literal(true),
        mode: z.literal(GIT_MODES.context),
        repoRoot: z.string(),
        message: z.string().optional().describe('error detail when isError'),
        isError: z.boolean().optional().describe('true when the operation failed'),
      }),
    },
    async ({ cwd, base, paths, limit, includeWorktrees }) => {
      try {
        const output = await collectContext({
          cwd,
          mode: 'context',
          base,
          paths: paths ?? [],
          limit: limit ?? DEFAULT_HISTORY_LIMIT,
          includeWorktrees: includeWorktrees ?? false,
        })
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      } catch (err) {
        const output = { message: `[Error: git context failed: ${(err as Error).message}]`, isError: true }
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output,
        }
      }
    },
  )
})
