import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { assembleGitContext } from '../git-context.ts'
import { collectGitHistory } from '../git-history.ts'
import { collectGitWorktrees } from '../git-worktrees.ts'

const tempDirs: string[] = []

const trackTempDir = (path: string): string => {
  tempDirs.push(path)
  return path
}

const runGit = async ({
  cwd,
  args,
}: {
  cwd: string
  args: string[]
}): Promise<{
  stdout: string
  stderr: string
}> => {
  const result = await Bun.$`git ${args}`.cwd(cwd).quiet().nothrow()
  const stdout = result.stdout.toString().trim()
  const stderr = result.stderr.toString().trim()

  if (result.exitCode !== 0) {
    throw new Error(`git ${args.join(' ')} failed: ${stderr || stdout || `exit ${result.exitCode}`}`)
  }

  return {
    stdout,
    stderr,
  }
}

const writeFile = async ({ cwd, path, content }: { cwd: string; path: string; content: string }) => {
  const absolutePath = join(cwd, path)
  await mkdir(dirname(absolutePath), { recursive: true })
  await Bun.write(absolutePath, content)
}

const createTempGitRepo = async () => {
  const rootDir = trackTempDir(await mkdtemp(join(tmpdir(), 'plaited-context-git-')))
  await runGit({ cwd: rootDir, args: ['init'] })
  await runGit({ cwd: rootDir, args: ['config', 'user.email', 'plaited-context@example.com'] })
  await runGit({ cwd: rootDir, args: ['config', 'user.name', 'Plaited Context Test'] })
  await runGit({ cwd: rootDir, args: ['checkout', '-b', 'dev'] })
  await writeFile({
    cwd: rootDir,
    path: 'README.md',
    content: '# temp git context repo\n',
  })
  await runGit({ cwd: rootDir, args: ['add', '.'] })
  await runGit({ cwd: rootDir, args: ['commit', '-m', 'chore: create baseline commit'] })

  await runGit({ cwd: rootDir, args: ['checkout', '-b', 'feature/git-context'] })

  await writeFile({
    cwd: rootDir,
    path: 'src/app.ts',
    content: `export const app = 'v1'\n`,
  })
  await runGit({ cwd: rootDir, args: ['add', 'src/app.ts'] })
  await runGit({ cwd: rootDir, args: ['commit', '-m', 'feat: create app baseline'] })

  await writeFile({
    cwd: rootDir,
    path: 'src/app.ts',
    content: `export const app = 'v2'\n`,
  })
  await runGit({ cwd: rootDir, args: ['add', 'src/app.ts'] })
  await runGit({ cwd: rootDir, args: ['commit', '-m', 'feat: update app implementation'] })

  await writeFile({
    cwd: rootDir,
    path: 'docs/feature.md',
    content: `# Feature Notes\n\nGit context integration notes.\n`,
  })
  await runGit({ cwd: rootDir, args: ['add', 'docs/feature.md'] })
  await runGit({ cwd: rootDir, args: ['commit', '-m', 'docs: add feature notes'] })

  return rootDir
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const directory = tempDirs.pop()
    if (!directory) {
      continue
    }
    await rm(directory, { recursive: true, force: true })
  }
})

describe('git-context scripts', () => {
  test('returns clean output and warning when requested base ref is missing', async () => {
    const rootDir = await createTempGitRepo()
    const canonicalRootDir = await realpath(rootDir)

    const output = await assembleGitContext({
      cwd: rootDir,
      base: 'origin/dev',
      paths: ['src'],
      limit: 20,
      includeWorktrees: false,
    })

    expect(output.ok).toBe(true)
    expect(output.repoRoot).toBe(canonicalRootDir)
    expect(output.base).toBe('origin/dev')
    expect(output.baseHead).toBeNull()
    expect(output.mergeBase).toBeNull()
    expect(output.dirty.isDirty).toBe(false)
    expect(output.warnings.some((warning) => warning.includes("Base ref 'origin/dev' could not be resolved"))).toBe(
      true,
    )
  })

  test('returns dirty summary with staged, unstaged, and untracked counts', async () => {
    const rootDir = await createTempGitRepo()

    await writeFile({
      cwd: rootDir,
      path: 'src/app.ts',
      content: `export const app = 'dirty-change'\n`,
    })
    await writeFile({
      cwd: rootDir,
      path: 'src/staged.ts',
      content: `export const staged = true\n`,
    })
    await runGit({ cwd: rootDir, args: ['add', 'src/staged.ts'] })
    await writeFile({
      cwd: rootDir,
      path: 'tmp-untracked.txt',
      content: 'untracked\n',
    })

    const output = await assembleGitContext({
      cwd: rootDir,
      base: 'dev',
      paths: ['src'],
      limit: 20,
      includeWorktrees: false,
    })

    expect(output.dirty.isDirty).toBe(true)
    expect(output.dirty.stagedCount).toBeGreaterThan(0)
    expect(output.dirty.unstagedCount).toBeGreaterThan(0)
    expect(output.dirty.untrackedCount).toBeGreaterThan(0)
    expect(output.warnings.some((warning) => warning.includes('Dirty worktree detected'))).toBe(true)
  })

  test('returns commits and changed files since local base', async () => {
    const rootDir = await createTempGitRepo()

    const output = await collectGitHistory({
      cwd: rootDir,
      base: 'dev',
      paths: ['src/app.ts'],
      limit: 20,
    })

    expect(output.ok).toBe(true)
    expect(output.base).toBe('dev')
    expect(output.baseHead).not.toBeNull()
    expect(output.mergeBase).not.toBeNull()
    expect(output.commitsSinceBase.length).toBeGreaterThanOrEqual(2)
    expect(output.changedFilesSinceBase.some((entry) => entry.path === 'src/app.ts')).toBe(true)
    expect(output.changedFilesSinceBase.some((entry) => entry.path === 'docs/feature.md')).toBe(true)
    expect(output.summary.commitCountSinceBase).toBe(output.commitsSinceBase.length)
    expect(output.summary.changedFileCountSinceBase).toBeGreaterThanOrEqual(2)
  })

  test('returns per-path history when paths are provided', async () => {
    const rootDir = await createTempGitRepo()

    const output = await collectGitHistory({
      cwd: rootDir,
      base: 'dev',
      paths: ['src/app.ts', 'docs/feature.md'],
      limit: 20,
    })

    expect(output.pathHistory).toHaveLength(2)
    const appHistory = output.pathHistory.find((entry) => entry.path === 'src/app.ts')
    const docsHistory = output.pathHistory.find((entry) => entry.path === 'docs/feature.md')
    expect(appHistory?.commits.length).toBeGreaterThanOrEqual(2)
    expect(docsHistory?.commits.length).toBeGreaterThanOrEqual(1)
  })

  test('parses worktree metadata when additional worktrees exist', async () => {
    const rootDir = await createTempGitRepo()
    const worktreeParent = trackTempDir(await mkdtemp(join(tmpdir(), 'plaited-context-worktree-parent-')))
    const secondaryWorktree = join(worktreeParent, 'secondary')

    await runGit({
      cwd: rootDir,
      args: ['worktree', 'add', '-b', 'feature/worktree-copy', secondaryWorktree, 'dev'],
    })
    const canonicalRootDir = await realpath(rootDir)
    const canonicalSecondaryWorktree = await realpath(secondaryWorktree)

    const output = await collectGitWorktrees({
      cwd: rootDir,
    })

    expect(output.ok).toBe(true)
    expect(output.worktrees.length).toBeGreaterThanOrEqual(2)
    expect(output.worktrees.some((entry) => entry.path === canonicalRootDir && entry.isCurrent)).toBe(true)
    expect(output.worktrees.some((entry) => entry.path === canonicalSecondaryWorktree)).toBe(true)
  })

  test('rejects paths that escape repository root', async () => {
    const rootDir = await createTempGitRepo()

    await expect(
      collectGitHistory({
        cwd: rootDir,
        base: 'dev',
        paths: ['../escape.ts'],
        limit: 20,
      }),
    ).rejects.toThrow("Invalid path '../escape.ts': path escapes repository root.")
  })

  test('quotes shell metacharacters in base ref suggested commands', async () => {
    const rootDir = await createTempGitRepo()
    const injectedBase = 'origin/dev; echo injected'

    const output = await collectGitHistory({
      cwd: rootDir,
      base: injectedBase,
      paths: [],
      limit: 1,
    })

    const mergeBaseSuggestion = output.suggestedNextCommands.find((command) => command.startsWith('git merge-base '))
    const revParseSuggestion = output.suggestedNextCommands.find((command) => command.startsWith('git rev-parse '))

    expect(mergeBaseSuggestion).toBe("git merge-base HEAD 'origin/dev; echo injected'")
    expect(mergeBaseSuggestion?.includes('HEAD origin/dev; echo injected')).toBe(false)
    expect(revParseSuggestion).toBe("git rev-parse --verify 'origin/dev; echo injected^{commit}'")
    expect(revParseSuggestion?.includes('--verify origin/dev; echo injected^{commit}')).toBe(false)
  })

  test('quotes path suggestions with spaces in git log command', async () => {
    const rootDir = await createTempGitRepo()
    const pathWithSpaces = 'docs/path with space.md'

    const output = await collectGitHistory({
      cwd: rootDir,
      base: 'dev',
      paths: [pathWithSpaces],
      limit: 1,
    })

    expect(output.suggestedNextCommands).toContain("git log --oneline -1 -- 'docs/path with space.md'")
  })

  test('renders git-context git-history suggestion with one quoted JSON argument', async () => {
    const rootDir = await createTempGitRepo()
    const base = 'origin/dev; echo injected'
    const paths = ['docs/path with space.md']

    const output = await assembleGitContext({
      cwd: rootDir,
      base,
      paths,
      limit: 1,
      includeWorktrees: false,
    })

    const historySuggestion = output.suggestedNextCommands.find((command) =>
      command.startsWith('bun skills/plaited-context/scripts/git-history.ts '),
    )
    expect(historySuggestion).toBeDefined()

    const quotedJsonMatch = historySuggestion?.match(
      /^bun skills\/plaited-context\/scripts\/git-history\.ts ('[^']+')$/,
    )
    expect(quotedJsonMatch).toBeDefined()

    const jsonPayload = quotedJsonMatch?.[1]?.slice(1, -1)
    expect(jsonPayload).toBeDefined()

    const parsedPayload = JSON.parse(jsonPayload ?? '{}') as {
      base?: string
      paths?: string[]
      limit?: number
    }
    expect(parsedPayload.base).toBe(base)
    expect(parsedPayload.paths).toEqual(paths)
    expect(parsedPayload.limit).toBe(1)
  })

  test('supports schema introspection for git scripts', async () => {
    const gitContextInputSchemaText = (
      await Bun.$`bun skills/plaited-context/scripts/git-context.ts --schema input`.cwd(process.cwd()).quiet()
    ).stdout.toString()
    const gitContextOutputSchemaText = (
      await Bun.$`bun skills/plaited-context/scripts/git-context.ts --schema output`.cwd(process.cwd()).quiet()
    ).stdout.toString()
    const gitHistoryOutputSchemaText = (
      await Bun.$`bun skills/plaited-context/scripts/git-history.ts --schema output`.cwd(process.cwd()).quiet()
    ).stdout.toString()
    const gitWorktreesOutputSchemaText = (
      await Bun.$`bun skills/plaited-context/scripts/git-worktrees.ts --schema output`.cwd(process.cwd()).quiet()
    ).stdout.toString()

    const gitContextInputSchema = JSON.parse(gitContextInputSchemaText) as {
      properties?: Record<string, unknown>
    }
    const gitContextOutputSchema = JSON.parse(gitContextOutputSchemaText) as {
      properties?: Record<string, unknown>
    }
    const gitHistoryOutputSchema = JSON.parse(gitHistoryOutputSchemaText) as {
      properties?: Record<string, unknown>
    }
    const gitWorktreesOutputSchema = JSON.parse(gitWorktreesOutputSchemaText) as {
      properties?: Record<string, unknown>
    }

    expect(gitContextInputSchema.properties?.base).toBeDefined()
    expect(gitContextInputSchema.properties?.includeWorktrees).toBeDefined()
    expect(gitContextOutputSchema.properties?.dirty).toBeDefined()
    expect(gitContextOutputSchema.properties?.commitsSinceBase).toBeDefined()
    expect(gitHistoryOutputSchema.properties?.changedFilesSinceBase).toBeDefined()
    expect(gitWorktreesOutputSchema.properties?.worktrees).toBeDefined()
  })
})
