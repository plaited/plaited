import { afterEach, describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, realpath, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

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

const runCli = async (input: unknown, ...extraArgs: string[]) => {
  const inputJson = JSON.stringify(input)
  const args = [JSON.stringify(inputJson), ...extraArgs.map((a) => JSON.stringify(a))]
  const proc = Bun.spawn(
    [
      'bun',
      '-e',
      [
        "import { gitContextCli } from '../git-context.ts'",
        `await gitContextCli['git-context']([${args.join(',')}])`,
      ].join(';\n'),
    ],
    { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
  )
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

afterEach(async () => {
  while (tempDirs.length > 0) {
    const path = tempDirs.pop()
    if (path) {
      await rm(path, { recursive: true, force: true })
    }
  }
})

describe('gitContextCli', () => {
  test('--help exits 0 and describes all four modes', async () => {
    const { exitCode, stderr } = await runCli(null, '--help')

    expect(exitCode).toBe(0)
    expect(stderr).toContain('status')
    expect(stderr).toContain('history')
    expect(stderr).toContain('worktrees')
    expect(stderr).toContain('context')
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

    const { exitCode, stdout } = await runCli({ mode: 'status', cwd: repoRoot })

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.repoRoot).toBe(canonicalRepoRoot)
    expect(output.dirty.isDirty).toBeTrue()
    expect(output.dirty.stagedFiles).toContain('src/staged.ts')
    expect(output.dirty.unstagedFiles).toContain('src/tracked.ts')
    expect(output.dirty.untrackedFiles).toContain('tmp-untracked.txt')
  })

  test('mode=history requires base', async () => {
    const repoRoot = await createTempGitRepo()
    const { exitCode } = await runCli({ mode: 'history', cwd: repoRoot })

    expect(exitCode).toBe(2)
  })

  test('mode=worktrees returns current worktree and parsed entries', async () => {
    const repoRoot = await createTempGitRepo()
    const { exitCode, stdout } = await runCli({ mode: 'worktrees', cwd: repoRoot })

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.currentWorktree).toBe('.')
    expect(output.worktrees.length).toBeGreaterThanOrEqual(1)
    expect(output.worktrees.some((entry: Record<string, unknown>) => entry.isCurrent)).toBeTrue()
    expect(output.worktrees.every((entry: Record<string, unknown>) => entry.exists)).toBeTrue()
  })

  test('mode=context omits worktrees unless includeWorktrees is true', async () => {
    const repoRoot = await createTempGitRepo()

    const defaultResult = await runCli({ mode: 'context', cwd: repoRoot, base: 'dev' })
    expect(defaultResult.exitCode).toBe(0)
    const defaultOutput = JSON.parse(defaultResult.stdout)
    expect(defaultOutput.worktrees).toHaveLength(0)
    expect(defaultOutput.summary.worktreeCount).toBe(0)

    const withWorktreesResult = await runCli({
      mode: 'context',
      cwd: repoRoot,
      base: 'dev',
      includeWorktrees: true,
    })
    expect(withWorktreesResult.exitCode).toBe(0)
    const withWorktreesOutput = JSON.parse(withWorktreesResult.stdout)
    expect(withWorktreesOutput.worktrees.length).toBeGreaterThanOrEqual(1)
    expect(withWorktreesOutput.summary.worktreeCount).toBeGreaterThanOrEqual(1)
  })

  test('mode=history rejects paths that escape repository root', async () => {
    const repoRoot = await createTempGitRepo()
    const { exitCode, stderr } = await runCli({
      mode: 'history',
      cwd: repoRoot,
      base: 'dev',
      paths: ['../escape.ts'],
    })

    expect(exitCode).toBe(1)
    expect(stderr).toContain('path escapes repository root')
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

    const { exitCode, stdout } = await runCli({ mode: 'status', cwd: repoRoot })

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.dirty.untrackedCount).toBe(205)
    expect(output.dirty.untrackedFiles).toHaveLength(200)
    expect(output.warnings.some((warning: string) => warning.includes('truncated to 200'))).toBeTrue()
  })

  test('mode=history returns merge-base history for supplied base', async () => {
    const repoRoot = await createTempGitRepo()
    const { exitCode, stdout } = await runCli({
      mode: 'history',
      cwd: repoRoot,
      base: 'dev',
      paths: ['src/tracked.ts'],
      limit: 20,
    })

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.base).toBe('dev')
    expect(output.baseHead).not.toBeNull()
    expect(output.mergeBase).not.toBeNull()
    expect(output.summary.commitCountSinceBase).toBeGreaterThanOrEqual(1)
    expect(output.summary.changedFileCountSinceBase).toBeGreaterThanOrEqual(1)
    expect(
      output.changedFilesSinceBase.some((entry: Record<string, unknown>) => entry.path === 'src/tracked.ts'),
    ).toBeTrue()
    expect(output.pathHistory).toHaveLength(1)
    expect(output.pathHistory[0]?.path).toBe('src/tracked.ts')
    expect(output.pathHistory[0]?.commits.length ?? 0).toBeGreaterThanOrEqual(1)
  })

  test('status preserves unquoted paths with spaces', async () => {
    const repoRoot = await createTempGitRepo()
    await writeFile({
      cwd: repoRoot,
      path: 'src/space name.ts',
      content: `export const spaced = true\n`,
    })

    const { exitCode, stdout } = await runCli({ mode: 'status', cwd: repoRoot })

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.dirty.untrackedFiles).toContain('src/space name.ts')
    expect(output.dirty.untrackedFiles).not.toContain('"src/space name.ts"')
  })

  test('--schema input emits JSON Schema with all four modes', async () => {
    const { exitCode, stdout } = await runCli(null, '--schema', 'input')

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.oneOf).toHaveLength(4)
    const historyBranch = output.oneOf?.find((branch: { properties?: Record<string, unknown> }) =>
      Object.hasOwn(branch.properties ?? {}, 'base'),
    )
    expect(historyBranch).toBeDefined()
  })

  test('--schema output emits output schema with all four modes', async () => {
    const { exitCode, stdout } = await runCli(null, '--schema', 'output')

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.oneOf).toHaveLength(4)
  })

  test('--dry-run prints request details without executing', async () => {
    const { exitCode, stdout } = await runCli({ mode: 'status', cwd: '/tmp' }, '--dry-run')

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.command).toBe('git-context')
    expect(output.dryRun).toBe(true)
    expect(output.input.mode).toBe('status')
  })

  test('rejects non-JSON input', async () => {
    const { exitCode } = await runCli(null, 'not-json')

    expect(exitCode).toBe(2)
  })

  test('rejects no input', async () => {
    const { exitCode } = await runCli(null)

    expect(exitCode).toBe(2)
  })
})
