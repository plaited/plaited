import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import {
  buildPiCommand,
  buildRunDir,
  buildScopeViolationMessage,
  buildStrategyNotes,
  commitAttempt,
  getLaneConfig,
  isAllowedPath,
  MAX_ATTEMPT_RETRIES,
  normalizeScriptPath,
  PI_WORKTREE_GUARD_EXTENSION_PATH,
  parseRunArgs,
  readChangedPaths,
  resolveWorkspaceRoot,
  selectPromotionDecision,
  summarizeDiff,
} from '../autoresearch-runner.ts'

describe('autoresearch-runner', () => {
  test('builds one strategy note per attempt', () => {
    const notes = buildStrategyNotes(6)

    expect(notes).toHaveLength(6)
    expect(notes[0]).toContain('minimal-diff-first')
  })

  test('returns lane config for mss-seed', async () => {
    const config = await getLaneConfig('scripts/mss-seed.ts')

    expect(config.scriptPath).toBe('scripts/mss-seed.ts')
    expect(config.programPath).toBe('dev-research/mss-seed/program.md')
    expect(config.validateCommand).toEqual(['bun', 'scripts/mss-seed.ts', 'validate'])
    expect(config.writableRoots).toEqual(['dev-research/mss-seed'])
    expect(config.defaultAttempts).toBe(20)
    expect(config.defaultParallelism).toBe(3)
    expect(config.model).toBe('openrouter/minimax/minimax-m2.7')
    expect(config.systemPrompt).toContain('mss-seed lane')
    expect(config.evaluation?.graderPath).toBe('scripts/mss-seed-grader.ts')
    expect(config.evaluation?.verifierPath).toBe('scripts/mss-seed-verifier.ts')
    expect(config.evaluation?.useMetaVerification).toBe(true)
    expect(config.skills?.length).toBeGreaterThan(0)
  })

  test('returns lane config for mss-corpus', async () => {
    const config = await getLaneConfig('./scripts/mss-corpus.ts')

    expect(config.scriptPath).toBe('scripts/mss-corpus.ts')
    expect(config.programPath).toBe('dev-research/mss-corpus/program.md')
    expect(config.validateCommand).toEqual(['bun', 'scripts/mss-corpus.ts', 'validate'])
    expect(config.writableRoots).toEqual(['dev-research/mss-corpus'])
    expect(config.systemPrompt).toContain('mss-corpus lane')
    expect(config.evaluation?.graderPath).toBe('scripts/mss-corpus-grader.ts')
    expect(config.evaluation?.verifierPath).toBe('scripts/mss-corpus-verifier.ts')
    expect(config.evaluation?.useMetaVerification).toBe(true)
  })

  test('parses run arguments with lane defaults', async () => {
    const parsed = await parseRunArgs(['scripts/mss-seed.ts'])

    expect(parsed.laneScriptPath).toBe('scripts/mss-seed.ts')
    expect(parsed.command).toBe('run')
    expect(parsed.attempts).toBe(20)
    expect(parsed.parallelism).toBe(3)
    expect(parsed.runDir).toBeNull()
  })

  test('parses explicit status arguments', async () => {
    const parsed = await parseRunArgs([
      './scripts/mss-corpus.ts',
      'status',
      '--attempts',
      '7',
      '--parallel',
      '2',
      '--run-dir',
      '/tmp/mss-run',
    ])

    expect(parsed.laneScriptPath).toBe('./scripts/mss-corpus.ts')
    expect(parsed.command).toBe('status')
    expect(parsed.attempts).toBe(7)
    expect(parsed.parallelism).toBe(2)
    expect(parsed.runDir).toBe('/tmp/mss-run')
  })

  test('parses explicit evaluate arguments', async () => {
    const parsed = await parseRunArgs(['scripts/mss-seed.ts', 'evaluate', '--run-dir', '/tmp/mss-run'])

    expect(parsed.command).toBe('evaluate')
    expect(parsed.runDir).toBe('/tmp/mss-run')
  })

  test('normalizes script paths for lane loading', () => {
    expect(normalizeScriptPath('./scripts/mss-seed.ts')).toBe('scripts/mss-seed.ts')
    expect(normalizeScriptPath('scripts/mss-corpus.ts')).toBe('scripts/mss-corpus.ts')
  })

  test('resolves workspace root from a nested repo directory', async () => {
    const workspaceRoot = await resolveWorkspaceRoot({ cwd: join(process.cwd(), 'scripts') })

    expect(workspaceRoot).toBe(process.cwd())
  })

  test('builds run directories inside the active workspace root', () => {
    const runDir = buildRunDir({ workspaceRoot: '/tmp/plaited-worktree', lane: 'mss-seed' })

    expect(runDir).toContain('/tmp/plaited-worktree/.prompts/autoresearch-runner/mss-seed/')
  })

  test('uses the Pi worktree guard extension', () => {
    expect(PI_WORKTREE_GUARD_EXTENSION_PATH).toBe('scripts/pi-worktree-guard-extension.ts')
  })

  test('passes the canonical repo root and extension into the Pi command', async () => {
    const config = await getLaneConfig('scripts/mss-seed.ts')

    const command = await buildPiCommand({
      config,
      strategy: 'minimal-diff-first',
      repoRoot: process.cwd(),
      workspaceRoot: process.cwd(),
    })

    expect(command).toContain('--extension')
    expect(command).toContain(`${process.cwd()}/scripts/pi-worktree-guard-extension.ts`)
    expect(command).toContain('--path')
    expect(command).toContain(process.cwd())
  })

  test('allowed-path enforcement accepts only configured writable roots', () => {
    expect(
      isAllowedPath({
        path: 'dev-research/mss-seed/seed/mss.jsonld',
        writableRoots: ['dev-research/mss-seed'],
      }),
    ).toBe(true)

    expect(
      isAllowedPath({
        path: 'scripts/mss-seed.ts',
        writableRoots: ['dev-research/mss-seed'],
      }),
    ).toBe(false)
  })

  test('builds a retryable scope violation message for the lane agent', () => {
    const message = buildScopeViolationMessage({
      disallowedPaths: ['scripts/mss-seed.ts'],
      writableRoots: ['dev-research/mss-seed'],
    })

    expect(message).toContain('outside the allowed lane surface')
    expect(message).toContain('scripts/mss-seed.ts')
    expect(message).toContain('dev-research/mss-seed')
  })

  test('exposes bounded retry count', () => {
    expect(MAX_ATTEMPT_RETRIES).toBe(2)
  })

  test('captures tracked and untracked changes from a git worktree', async () => {
    const root = await mkdtemp(join('/tmp', 'plaited-runner-git-'))
    await Bun.$`git init`.cwd(root).quiet()
    await Bun.$`git config user.name test`.cwd(root).quiet()
    await Bun.$`git config user.email test@example.com`.cwd(root).quiet()
    await Bun.write(join(root, 'tracked.txt'), 'base\n')
    await Bun.$`git add tracked.txt`.cwd(root).quiet()
    await Bun.$`git commit -m init`.cwd(root).quiet()
    await Bun.write(join(root, 'tracked.txt'), 'changed\n')
    await Bun.write(join(root, 'new.txt'), 'new\n')

    const changedPaths = await readChangedPaths(root)
    const diffStat = await summarizeDiff(root)

    expect(changedPaths).toContain('tracked.txt')
    expect(changedPaths).toContain('new.txt')
    expect(diffStat).toContain('tracked.txt')
    expect(diffStat).toContain('untracked files:')
    expect(diffStat).toContain('new.txt')

    await rm(root, { force: true, recursive: true })
  })

  test('creates an attempt commit in a validated workspace', async () => {
    const root = await mkdtemp(join('/tmp', 'plaited-runner-commit-'))
    await Bun.$`git init`.cwd(root).quiet()
    await Bun.$`git config user.name test`.cwd(root).quiet()
    await Bun.$`git config user.email test@example.com`.cwd(root).quiet()
    await Bun.write(join(root, 'tracked.txt'), 'base\n')
    await Bun.$`git add tracked.txt`.cwd(root).quiet()
    await Bun.$`git commit -m init`.cwd(root).quiet()
    await Bun.write(join(root, 'tracked.txt'), 'changed\n')

    const commit = await commitAttempt({
      worktreePath: root,
      laneKey: 'mss-seed',
      attempt: 2,
    })
    const head = (await (await Bun.$`git rev-parse HEAD`.cwd(root).quiet()).text()).trim()
    const log = await Bun.$`git log --oneline -1`.cwd(root).quiet()

    expect(commit).toHaveLength(40)
    expect(head).toBe(commit)
    expect(await log.text()).toContain('capture mss-seed attempt 02')

    await rm(root, { force: true, recursive: true })
  })

  test('writes a promotion summary for validated evaluated attempts', async () => {
    const root = await mkdtemp(join('/tmp', 'plaited-runner-promotion-'))
    const runDir = join(root, '.prompts', 'autoresearch-runner', 'mss-seed', 'run-1')
    await Bun.$`mkdir -p ${join(runDir, 'attempt-01')} ${join(runDir, 'attempt-02')}`.quiet()
    await Bun.write(
      join(runDir, 'attempt-01', 'status.json'),
      `${JSON.stringify({
        attempt: 1,
        strategy: 's1',
        worktreePath: join(root, 'attempt-01-repo'),
        status: 'completed',
      })}\n`,
    )
    await Bun.write(
      join(runDir, 'attempt-02', 'status.json'),
      `${JSON.stringify({
        attempt: 2,
        strategy: 's2',
        worktreePath: join(root, 'attempt-02-repo'),
        status: 'completed',
      })}\n`,
    )
    await Bun.write(
      join(runDir, 'attempt-01', 'result.json'),
      `${JSON.stringify({
        attempt: 1,
        strategy: 's1',
        retryCount: 0,
        piExitCode: 0,
        validateExitCode: 0,
        diffStat: '1 file changed',
        changedPaths: ['dev-research/mss-seed/seed/a.jsonld'],
        disallowedPaths: [],
        worktreePath: join(root, 'attempt-01-repo'),
        attemptCommit: 'aaa111',
      })}\n`,
    )
    await Bun.write(
      join(runDir, 'attempt-02', 'result.json'),
      `${JSON.stringify({
        attempt: 2,
        strategy: 's2',
        retryCount: 0,
        piExitCode: 0,
        validateExitCode: 0,
        diffStat: '2 files changed',
        changedPaths: ['dev-research/mss-seed/seed/b.jsonld'],
        disallowedPaths: [],
        worktreePath: join(root, 'attempt-02-repo'),
        attemptCommit: 'bbb222',
      })}\n`,
    )
    await Bun.write(
      join(runDir, 'attempt-01', 'evaluation.json'),
      `${JSON.stringify({
        attempt: 1,
        pass: true,
        score: 0.82,
        reasoning: 'good',
        outcome: { metaVerification: { confidence: 0.7 } },
      })}\n`,
    )
    await Bun.write(
      join(runDir, 'attempt-02', 'evaluation.json'),
      `${JSON.stringify({
        attempt: 2,
        pass: true,
        score: 0.91,
        reasoning: 'better',
        outcome: { metaVerification: { confidence: 0.86 } },
      })}\n`,
    )

    const originalFetch = globalThis.fetch
    const originalKey = process.env.OPENROUTER_API_KEY
    process.env.OPENROUTER_API_KEY = 'test-key'
    globalThis.fetch = (async () =>
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  action: 'promote_one',
                  selectedAttempt: 2,
                  selectedCommit: 'bbb222',
                  confidence: 0.88,
                  reasoning: 'Attempt 2 is the clearest winner.',
                }),
              },
            },
          ],
        }),
        { status: 200 },
      )) as unknown as typeof fetch

    try {
      const summary = await selectPromotionDecision({
        repoRoot: root,
        runDir,
        attempts: 2,
        config: {
          key: 'mss-seed',
          scriptPath: 'scripts/mss-seed.ts',
          programPath: 'dev-research/mss-seed/program.md',
          validateCommand: ['bun', 'scripts/mss-seed.ts', 'validate'],
          writableRoots: ['dev-research/mss-seed'],
          taskPrompt: 'x',
          defaultAttempts: 20,
          defaultParallelism: 3,
        },
      })

      const summaryFile = Bun.file(join(runDir, 'promotion-summary.json'))
      expect(summary?.action).toBe('promote_one')
      expect(summary?.selectedAttempt).toBe(2)
      expect(summary?.selectedCommit).toBe('bbb222')
      expect(await summaryFile.exists()).toBe(true)
    } finally {
      globalThis.fetch = originalFetch
      if (originalKey === undefined) delete process.env.OPENROUTER_API_KEY
      else process.env.OPENROUTER_API_KEY = originalKey
      await rm(root, { force: true, recursive: true })
    }
  })
})
