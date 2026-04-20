import { stat } from 'node:fs/promises'
import { isAbsolute, relative, resolve } from 'node:path'
import * as z from 'zod'

const toPosix = (value: string) => value.replace(/\\/g, '/')

const quoteArg = (value: string) => {
  if (value === '') {
    return "''"
  }

  if (/^[A-Za-z0-9_./:@=+-]+$/.test(value)) {
    return value
  }

  return `'${value.replaceAll("'", "'\\''")}'`
}

export const formatGitCommand = (args: string[]): string => ['git', ...args].map((arg) => quoteArg(arg)).join(' ')

export class GitCommandError extends Error {
  readonly code = 'GIT_COMMAND_FAILED'
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

export const GitCommitSchema = z
  .object({
    fullSha: z.string().min(1).describe('Full commit SHA.'),
    shortSha: z.string().min(1).describe('Short commit SHA for quick inspection.'),
    committedAt: z.string().min(1).describe('Commit timestamp in ISO format.'),
    subject: z.string().min(1).describe('Commit subject line.'),
  })
  .describe('Commit summary entry.')

export const GitChangedFileSchema = z
  .object({
    status: z.enum(['A', 'C', 'D', 'M', 'R', 'T', 'U', 'X']).describe('Normalized one-letter Git change status.'),
    rawStatus: z.string().min(1).describe('Raw Git status token, including rename/copy score when present.'),
    path: z.string().min(1).describe('Changed path relative to the repository root.'),
    oldPath: z.string().min(1).optional().describe('Previous path for rename/copy entries.'),
  })
  .describe('Changed file entry from a Git diff.')

export const GitPathHistoryEntrySchema = z
  .object({
    path: z.string().min(1).describe('Validated path relative to the repository root.'),
    commits: z.array(GitCommitSchema).describe('Most recent commits touching this path.'),
  })
  .describe('Per-path recent commit history entry.')

export const GitWorktreeEntrySchema = z
  .object({
    path: z.string().min(1).describe('Absolute worktree path.'),
    head: z.string().min(1).describe('HEAD commit SHA for the worktree.'),
    branch: z.string().nullable().describe('Branch ref for this worktree when attached; null when detached.'),
    detached: z.boolean().describe('True when the worktree is detached.'),
    bare: z.boolean().describe('True when the worktree is bare.'),
    lockedReason: z.string().nullable().describe('Lock reason when present.'),
    prunableReason: z.string().nullable().describe('Prunable reason when reported by Git.'),
    exists: z.boolean().describe('True when the worktree path exists on disk.'),
    isCurrent: z.boolean().describe('True when this is the current worktree.'),
  })
  .describe('Parsed worktree metadata from `git worktree list --porcelain`.')

export type GitCommit = z.infer<typeof GitCommitSchema>
export type GitChangedFile = z.infer<typeof GitChangedFileSchema>
export type GitPathHistoryEntry = z.infer<typeof GitPathHistoryEntrySchema>
export type GitWorktreeEntry = z.infer<typeof GitWorktreeEntrySchema>

const isSubPath = (candidate: string, rootPath: string): boolean => {
  const relativePath = relative(rootPath, candidate)
  return relativePath === '' || (!relativePath.startsWith('..') && !isAbsolute(relativePath))
}

const trimRef = (value: string) => value.trim()

const parseGitLogRows = (stdout: string): GitCommit[] => {
  if (!stdout.trim()) {
    return []
  }

  const commits: GitCommit[] = []
  for (const line of stdout.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

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

const parseNameStatusRows = (stdout: string): GitChangedFile[] => {
  if (!stdout.trim()) {
    return []
  }

  const changed: GitChangedFile[] = []
  for (const rawLine of stdout.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) {
      continue
    }

    const parts = line.split('\t')
    const rawStatus = parts[0]?.trim() ?? ''
    const normalizedStatus = rawStatus[0] as GitChangedFile['status'] | undefined
    if (!rawStatus || !normalizedStatus || !['A', 'C', 'D', 'M', 'R', 'T', 'U', 'X'].includes(normalizedStatus)) {
      continue
    }

    if ((normalizedStatus === 'R' || normalizedStatus === 'C') && parts.length >= 3) {
      const oldPath = parts[1]?.trim()
      const path = parts[2]?.trim()
      if (!oldPath || !path) {
        continue
      }
      changed.push({
        status: normalizedStatus,
        rawStatus,
        path,
        oldPath,
      })
      continue
    }

    const path = parts[1]?.trim()
    if (!path) {
      continue
    }

    changed.push({
      status: normalizedStatus,
      rawStatus,
      path,
    })
  }

  return changed
}

const pathExists = async (value: string): Promise<boolean> => {
  try {
    await stat(value)
    return true
  } catch {
    return false
  }
}

export const runGit = async ({
  cwd,
  args,
  allowFailure = false,
}: {
  cwd: string
  args: string[]
  allowFailure?: boolean
}): Promise<{
  stdout: string
  stderr: string
  exitCode: number
  command: string
}> => {
  const command = formatGitCommand(args)
  const result = await Bun.$`git ${args}`.cwd(cwd).quiet().nothrow()
  const stdout = result.stdout.toString().trimEnd()
  const stderr = result.stderr.toString().trim()
  if (result.exitCode !== 0 && !allowFailure) {
    throw new GitCommandError({
      command,
      exitCode: result.exitCode,
      stderr,
    })
  }

  return {
    stdout,
    stderr,
    exitCode: result.exitCode,
    command,
  }
}

export const resolveGitRepoRoot = async (cwd: string): Promise<string> => {
  const result = await runGit({
    cwd,
    args: ['rev-parse', '--show-toplevel'],
  })
  return resolve(result.stdout.trim())
}

export const resolvePathWithinRepo = ({ repoRoot, value }: { repoRoot: string; value: string }): string => {
  const trimmed = value.trim()
  if (!trimmed) {
    throw new Error(`Invalid path '${value}': empty paths are not allowed.`)
  }

  const absolute = isAbsolute(trimmed) ? resolve(trimmed) : resolve(repoRoot, trimmed)
  if (!isSubPath(absolute, repoRoot)) {
    throw new Error(`Invalid path '${value}': path escapes repository root.`)
  }

  const relativePath = toPosix(relative(repoRoot, absolute))
  return relativePath === '' ? '.' : relativePath
}

export const resolvePathListWithinRepo = ({ repoRoot, paths }: { repoRoot: string; paths: string[] }): string[] => {
  const entries = new Set<string>()
  for (const path of paths) {
    entries.add(resolvePathWithinRepo({ repoRoot, value: path }))
  }
  return [...entries]
}

export const resolveGitRef = async ({ cwd, ref }: { cwd: string; ref: string }): Promise<string | null> => {
  const resolved = await runGit({
    cwd,
    args: ['rev-parse', '--verify', `${ref}^{commit}`],
    allowFailure: true,
  })
  if (resolved.exitCode !== 0) {
    return null
  }

  return trimRef(resolved.stdout)
}

export const collectCommits = async ({
  cwd,
  range,
  limit,
}: {
  cwd: string
  range: string
  limit: number
}): Promise<GitCommit[]> => {
  const logResult = await runGit({
    cwd,
    args: ['log', '--no-decorate', '--date=iso-strict', '--pretty=format:%H%x09%h%x09%cI%x09%s', `-n${limit}`, range],
  })
  return parseGitLogRows(logResult.stdout)
}

export const collectPathHistory = async ({
  cwd,
  paths,
  limit,
}: {
  cwd: string
  paths: string[]
  limit: number
}): Promise<GitPathHistoryEntry[]> => {
  const histories: GitPathHistoryEntry[] = []
  for (const path of paths) {
    const logResult = await runGit({
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

    histories.push({
      path,
      commits: parseGitLogRows(logResult.stdout),
    })
  }

  return histories
}

export const collectChangedFiles = async ({
  cwd,
  mergeBase,
}: {
  cwd: string
  mergeBase: string
}): Promise<GitChangedFile[]> => {
  const diffResult = await runGit({
    cwd,
    args: ['diff', '--name-status', `${mergeBase}...HEAD`],
  })
  return parseNameStatusRows(diffResult.stdout)
}

export const resolveMergeBase = async ({ cwd, baseRef }: { cwd: string; baseRef: string }): Promise<string | null> => {
  const mergeBaseResult = await runGit({
    cwd,
    args: ['merge-base', 'HEAD', baseRef],
    allowFailure: true,
  })

  if (mergeBaseResult.exitCode !== 0) {
    return null
  }

  return mergeBaseResult.stdout.trim()
}

type ParsedWorktreeAccumulator = {
  path: string
  head: string
  branch: string | null
  detached: boolean
  bare: boolean
  lockedReason: string | null
  prunableReason: string | null
}

const createWorktreeAccumulator = (path: string): ParsedWorktreeAccumulator => ({
  path,
  head: '',
  branch: null,
  detached: false,
  bare: false,
  lockedReason: null,
  prunableReason: null,
})

const parseWorktreeList = (stdout: string): ParsedWorktreeAccumulator[] => {
  const parsed: ParsedWorktreeAccumulator[] = []
  let current: ParsedWorktreeAccumulator | null = null

  for (const line of stdout.split(/\r?\n/)) {
    if (!line.trim()) {
      continue
    }

    if (line.startsWith('worktree ')) {
      if (current) {
        parsed.push(current)
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
    parsed.push(current)
  }

  return parsed
}

export const collectWorktrees = async ({
  cwd,
  currentWorktree,
}: {
  cwd: string
  currentWorktree: string
}): Promise<GitWorktreeEntry[]> => {
  const worktreeResult = await runGit({
    cwd,
    args: ['worktree', 'list', '--porcelain'],
  })
  const parsed = parseWorktreeList(worktreeResult.stdout)

  const rows: GitWorktreeEntry[] = []
  for (const entry of parsed) {
    const absolutePath = resolve(entry.path)
    rows.push({
      path: absolutePath,
      head: entry.head,
      branch: entry.branch,
      detached: entry.detached,
      bare: entry.bare,
      lockedReason: entry.lockedReason,
      prunableReason: entry.prunableReason,
      exists: await pathExists(absolutePath),
      isCurrent: absolutePath === currentWorktree,
    })
  }

  return rows
}

export const collectDirtyState = async ({
  cwd,
}: {
  cwd: string
}): Promise<{
  stagedFiles: string[]
  unstagedFiles: string[]
  untrackedFiles: string[]
}> => {
  const statusResult = await runGit({
    cwd,
    args: ['status', '--porcelain', '--branch'],
  })

  const stagedFiles = new Set<string>()
  const unstagedFiles = new Set<string>()
  const untrackedFiles = new Set<string>()
  const lines = statusResult.stdout.split(/\r?\n/)

  for (const line of lines) {
    if (!line || line.startsWith('## ')) {
      continue
    }

    if (line.startsWith('?? ')) {
      const path = line.slice(3).trim()
      if (path) {
        untrackedFiles.add(path)
      }
      continue
    }

    if (line.startsWith('!! ')) {
      continue
    }

    const x = line[0] ?? ' '
    const y = line[1] ?? ' '
    const rawPath = line.slice(3).trim()
    if (!rawPath) {
      continue
    }

    const path = rawPath.includes(' -> ') ? (rawPath.split(' -> ').at(-1)?.trim() ?? rawPath) : rawPath
    if (x !== ' ') {
      stagedFiles.add(path)
    }
    if (y !== ' ') {
      unstagedFiles.add(path)
    }
  }

  return {
    stagedFiles: [...stagedFiles].sort(),
    unstagedFiles: [...unstagedFiles].sort(),
    untrackedFiles: [...untrackedFiles].sort(),
  }
}

export const resolveCurrentBranch = async ({ cwd }: { cwd: string }): Promise<string | null> => {
  const branch = await runGit({
    cwd,
    args: ['branch', '--show-current'],
  })
  const value = branch.stdout.trim()
  return value ? value : null
}

export const resolveHead = async ({ cwd }: { cwd: string }): Promise<string> => {
  const head = await runGit({
    cwd,
    args: ['rev-parse', 'HEAD'],
  })
  return head.stdout.trim()
}

export const resolveUpstream = async ({ cwd }: { cwd: string }): Promise<string | null> => {
  const upstream = await runGit({
    cwd,
    args: ['rev-parse', '--abbrev-ref', '--symbolic-full-name', '@{upstream}'],
    allowFailure: true,
  })
  if (upstream.exitCode !== 0) {
    return null
  }
  const value = upstream.stdout.trim()
  return value ? value : null
}

export const buildStructuredCliError = (
  error: unknown,
): {
  ok: false
  error: {
    code: string
    message: string
    command?: string
    exitCode?: number
    stderr?: string
  }
} => {
  if (error instanceof GitCommandError) {
    return {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        command: error.command,
        exitCode: error.exitCode,
        stderr: error.stderr,
      },
    }
  }

  if (error instanceof Error) {
    return {
      ok: false,
      error: {
        code: 'UNKNOWN_ERROR',
        message: error.message,
      },
    }
  }

  return {
    ok: false,
    error: {
      code: 'UNKNOWN_ERROR',
      message: 'Unknown error',
    },
  }
}
