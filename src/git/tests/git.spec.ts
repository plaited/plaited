import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../')

const tempDirs: string[] = []

const trackTempDir = (path: string): string => {
  tempDirs.push(path)
  return path
}

const runGit = async ({ cwd, args }: { cwd: string; args: string[] }): Promise<void> => {
  const result = await Bun.$`git ${args}`.cwd(cwd).quiet().nothrow()
  if (result.exitCode !== 0) {
    const stderr = result.stderr.toString().trim()
    const stdout = result.stdout.toString().trim()
    throw new Error(`git ${args.join(' ')} failed: ${stderr || stdout || `exit ${result.exitCode}`}`)
  }
}

const writeFile = async ({ cwd, path, content }: { cwd: string; path: string; content: string }): Promise<void> => {
  const absolutePath = join(cwd, path)
  await mkdir(dirname(absolutePath), { recursive: true })
  await Bun.write(absolutePath, content)
}

const createTempGitRepo = async (): Promise<string> => {
  const rootDir = trackTempDir(await mkdtemp(join(tmpdir(), 'plaited-git-cli-')))
  await runGit({ cwd: rootDir, args: ['init'] })
  await runGit({ cwd: rootDir, args: ['config', 'user.email', 'plaited-git@example.com'] })
  await runGit({ cwd: rootDir, args: ['config', 'user.name', 'Plaited Git Test'] })
  await runGit({ cwd: rootDir, args: ['checkout', '-b', 'dev'] })

  await writeFile({ cwd: rootDir, path: 'README.md', content: '# temp\n' })
  await runGit({ cwd: rootDir, args: ['add', '.'] })
  await runGit({ cwd: rootDir, args: ['commit', '-m', 'chore: baseline'] })
  await runGit({ cwd: rootDir, args: ['checkout', '-b', 'feature/git-cli'] })
  await writeFile({
    cwd: rootDir,
    path: 'src/tracked.ts',
    content: `export const tracked = 'initial'\n`,
  })
  await runGit({ cwd: rootDir, args: ['add', 'src/tracked.ts'] })
  await runGit({ cwd: rootDir, args: ['commit', '-m', 'feat: add tracked file'] })

  return rootDir
}

const runPlaitedGitCommand = async (input: unknown) =>
  Bun.$`bun ./bin/plaited.ts git ${JSON.stringify(input)}`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

afterEach(async () => {
  while (tempDirs.length > 0) {
    const path = tempDirs.pop()
    if (path) {
      await rm(path, { recursive: true, force: true })
    }
  }
})

describe('plaited git CLI', () => {
  test('plaited --schema includes git', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts --schema`.cwd(CLI_PACKAGE_ROOT).quiet().nothrow()

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as { commands?: string[] }
    expect(output.commands).toContain('git')
  })

  test('mode=status reports staged, unstaged, and untracked files', async () => {
    const repoRoot = await createTempGitRepo()
    const canonicalRepoRoot = await realpath(repoRoot)

    await writeFile({
      cwd: repoRoot,
      path: 'src/staged.ts',
      content: `export const staged = true\n`,
    })
    await runGit({ cwd: repoRoot, args: ['add', 'src/staged.ts'] })
    await writeFile({
      cwd: repoRoot,
      path: 'src/tracked.ts',
      content: `export const tracked = 'modified'\n`,
    })
    await writeFile({
      cwd: repoRoot,
      path: 'tmp-untracked.txt',
      content: 'untracked\n',
    })

    const result = await runPlaitedGitCommand({
      mode: 'status',
      cwd: repoRoot,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as {
      repoRoot: string
      dirty: {
        isDirty: boolean
        stagedFiles: string[]
        unstagedFiles: string[]
        untrackedFiles: string[]
      }
    }
    expect(output.repoRoot).toBe(canonicalRepoRoot)
    expect(output.dirty.isDirty).toBeTrue()
    expect(output.dirty.stagedFiles).toContain('src/staged.ts')
    expect(output.dirty.unstagedFiles).toContain('src/tracked.ts')
    expect(output.dirty.untrackedFiles).toContain('tmp-untracked.txt')
  })

  test('mode=status preserves unquoted paths with spaces', async () => {
    const repoRoot = await createTempGitRepo()
    await writeFile({
      cwd: repoRoot,
      path: 'src/space name.ts',
      content: `export const spaced = true\n`,
    })

    const result = await runPlaitedGitCommand({
      mode: 'status',
      cwd: repoRoot,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as {
      dirty: {
        untrackedFiles: string[]
      }
    }
    expect(output.dirty.untrackedFiles).toContain('src/space name.ts')
    expect(output.dirty.untrackedFiles).not.toContain('"src/space name.ts"')
  })

  test('mode=history requires base', async () => {
    const repoRoot = await createTempGitRepo()
    const result = await runPlaitedGitCommand({
      mode: 'history',
      cwd: repoRoot,
    })

    expect(result.exitCode).toBe(2)
    expect(result.stderr.toString()).toContain('base')
  })

  test('mode=history returns merge-base history details for supplied base', async () => {
    const repoRoot = await createTempGitRepo()
    const result = await runPlaitedGitCommand({
      mode: 'history',
      cwd: repoRoot,
      base: 'dev',
      paths: ['src/tracked.ts'],
      limit: 20,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as {
      base: string
      baseHead: string | null
      mergeBase: string | null
      commitsSinceBase: Array<{ fullSha: string }>
      changedFilesSinceBase: Array<{ path: string }>
      pathHistory: Array<{ path: string; commits: unknown[] }>
      summary: { changedFileCountSinceBase: number; commitCountSinceBase: number }
    }
    expect(output.base).toBe('dev')
    expect(output.baseHead).not.toBeNull()
    expect(output.mergeBase).not.toBeNull()
    expect(output.summary.commitCountSinceBase).toBeGreaterThanOrEqual(1)
    expect(output.summary.changedFileCountSinceBase).toBeGreaterThanOrEqual(1)
    expect(output.commitsSinceBase.length).toBeGreaterThanOrEqual(1)
    expect(output.changedFilesSinceBase.some((entry) => entry.path === 'src/tracked.ts')).toBeTrue()
    expect(output.pathHistory).toHaveLength(1)
    expect(output.pathHistory[0]?.path).toBe('src/tracked.ts')
    expect(output.pathHistory[0]?.commits.length ?? 0).toBeGreaterThanOrEqual(1)
  })

  test('mode=worktrees returns current worktree and parsed entries', async () => {
    const repoRoot = await createTempGitRepo()
    const result = await runPlaitedGitCommand({
      mode: 'worktrees',
      cwd: repoRoot,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as {
      currentWorktree: string
      worktrees: Array<{ isCurrent: boolean; exists: boolean }>
    }
    expect(output.currentWorktree).toBe('.')
    expect(output.worktrees.length).toBeGreaterThanOrEqual(1)
    expect(output.worktrees.some((entry) => entry.isCurrent)).toBeTrue()
    expect(output.worktrees.every((entry) => entry.exists)).toBeTrue()
  })

  test('mode=context omits worktrees unless includeWorktrees is true', async () => {
    const repoRoot = await createTempGitRepo()
    const defaultResult = await runPlaitedGitCommand({
      mode: 'context',
      cwd: repoRoot,
      base: 'dev',
    })

    expect(defaultResult.exitCode).toBe(0)
    const defaultOutput = JSON.parse(defaultResult.stdout.toString().trim()) as {
      worktrees: unknown[]
      summary: { worktreeCount: number }
    }
    expect(defaultOutput.worktrees).toHaveLength(0)
    expect(defaultOutput.summary.worktreeCount).toBe(0)

    const withWorktreesResult = await runPlaitedGitCommand({
      mode: 'context',
      cwd: repoRoot,
      base: 'dev',
      includeWorktrees: true,
    })

    expect(withWorktreesResult.exitCode).toBe(0)
    const withWorktreesOutput = JSON.parse(withWorktreesResult.stdout.toString().trim()) as {
      worktrees: unknown[]
      summary: { worktreeCount: number }
    }
    expect(withWorktreesOutput.worktrees.length).toBeGreaterThanOrEqual(1)
    expect(withWorktreesOutput.summary.worktreeCount).toBeGreaterThanOrEqual(1)
  })

  test('mode=history rejects paths that escape repository root', async () => {
    const repoRoot = await createTempGitRepo()
    const result = await runPlaitedGitCommand({
      mode: 'history',
      cwd: repoRoot,
      base: 'dev',
      paths: ['../escape.ts'],
    })

    expect(result.exitCode).toBe(1)
    expect(result.stderr.toString()).toContain('path escapes repository root')
  })

  test('file lists are capped at 200 entries with truncation warnings', async () => {
    const repoRoot = await createTempGitRepo()

    for (let index = 0; index < 205; index += 1) {
      await writeFile({
        cwd: repoRoot,
        path: `tmp/untracked-${index}.txt`,
        content: `file-${index}\n`,
      })
    }

    const result = await runPlaitedGitCommand({
      mode: 'status',
      cwd: repoRoot,
    })

    expect(result.exitCode).toBe(0)
    const output = JSON.parse(result.stdout.toString().trim()) as {
      dirty: { untrackedCount: number; untrackedFiles: string[] }
      warnings: string[]
    }
    expect(output.dirty.untrackedCount).toBe(205)
    expect(output.dirty.untrackedFiles).toHaveLength(200)
    expect(output.warnings.some((warning) => warning.includes('truncated to 200'))).toBeTrue()
  })

  test('git schemas expose mode and base in CLI contracts', async () => {
    const inputSchemaResult = await Bun.$`bun ./bin/plaited.ts git --schema input`
      .cwd(CLI_PACKAGE_ROOT)
      .quiet()
      .nothrow()
    const outputSchemaResult = await Bun.$`bun ./bin/plaited.ts git --schema output`
      .cwd(CLI_PACKAGE_ROOT)
      .quiet()
      .nothrow()

    expect(inputSchemaResult.exitCode).toBe(0)
    expect(outputSchemaResult.exitCode).toBe(0)

    const inputSchema = JSON.parse(inputSchemaResult.stdout.toString().trim()) as {
      oneOf?: Array<{ properties?: Record<string, unknown>; required?: string[] }>
    }
    const outputSchema = JSON.parse(outputSchemaResult.stdout.toString().trim()) as {
      oneOf?: Array<{ properties?: Record<string, unknown> }>
    }

    expect((inputSchema.oneOf ?? []).length).toBe(4)
    const historyInputBranch = (inputSchema.oneOf ?? []).find((branch) =>
      Object.hasOwn(branch.properties ?? {}, 'base'),
    )
    expect(historyInputBranch?.required).toContain('base')

    expect((outputSchema.oneOf ?? []).length).toBe(4)
  })
})
