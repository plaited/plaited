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
  resolveLaneSkills,
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

  test('returns lane config for behavioral-factories', async () => {
    const config = await getLaneConfig('scripts/behavioral-factories.ts')

    expect(config.scriptPath).toBe('scripts/behavioral-factories.ts')
    expect(config.programPath).toBe('dev-research/behavioral-factories/program.md')
    expect(config.validateCommand).toEqual(['bun', 'scripts/behavioral-factories.ts', 'validate'])
    expect(config.writableRoots).toEqual(['dev-research/behavioral-factories'])
    expect(config.defaultAttempts).toBe(20)
    expect(config.defaultParallelism).toBe(3)
    expect(config.model).toBe('openrouter/minimax/minimax-m2.7')
    expect(config.systemPrompt).toContain('behavioral-factories lane')
    expect(config.evaluation?.graderPath).toBe('scripts/behavioral-factories-grader.ts')
    expect(config.evaluation?.verifierPath).toBe('scripts/behavioral-factories-verifier.ts')
    expect(config.evaluation?.useMetaVerification).toBe(true)
    expect(config.skills?.length).toBeGreaterThan(0)
    expect(config.optionalSkillsByTag?.ui).toEqual(['skills/generative-ui'])
    expect(config.optionalSkillsByTag?.['agent-loop']).toEqual(['skills/agent-loop'])
  })

  test('resolves optional lane skills from tags', async () => {
    const config = await getLaneConfig('scripts/behavioral-factories.ts')
    const originalTags = process.env.PLAITED_RESEARCH_SKILL_TAGS
    process.env.PLAITED_RESEARCH_SKILL_TAGS = 'ui,agent-loop web'

    try {
      expect(resolveLaneSkills(config)).toEqual([
        'skills/behavioral-core',
        'skills/constitution',
        'skills/hypergraph-memory',
        'skills/mss',
        'skills/generative-ui',
        'skills/agent-loop',
        'skills/youdotcom-api',
      ])
    } finally {
      if (originalTags === undefined) delete process.env.PLAITED_RESEARCH_SKILL_TAGS
      else process.env.PLAITED_RESEARCH_SKILL_TAGS = originalTags
    }
  })

  test('parses run arguments with lane defaults', async () => {
    const parsed = await parseRunArgs(['scripts/behavioral-factories.ts'])

    expect(parsed.laneScriptPath).toBe('scripts/behavioral-factories.ts')
    expect(parsed.command).toBe('run')
    expect(parsed.attempts).toBe(20)
    expect(parsed.parallelism).toBe(3)
    expect(parsed.runDir).toBeNull()
  })

  test('parses explicit status arguments', async () => {
    const parsed = await parseRunArgs([
      './scripts/behavioral-factories.ts',
      'status',
      '--attempts',
      '7',
      '--parallel',
      '2',
      '--run-dir',
      '/tmp/factory-run',
    ])

    expect(parsed.laneScriptPath).toBe('./scripts/behavioral-factories.ts')
    expect(parsed.command).toBe('status')
    expect(parsed.attempts).toBe(7)
    expect(parsed.parallelism).toBe(2)
    expect(parsed.runDir).toBe('/tmp/factory-run')
  })

  test('parses explicit evaluate arguments', async () => {
    const parsed = await parseRunArgs(['scripts/behavioral-factories.ts', 'evaluate', '--run-dir', '/tmp/factory-run'])

    expect(parsed.command).toBe('evaluate')
    expect(parsed.runDir).toBe('/tmp/factory-run')
  })

  test('normalizes script paths for lane loading', () => {
    expect(normalizeScriptPath('./scripts/behavioral-factories.ts')).toBe('scripts/behavioral-factories.ts')
    expect(normalizeScriptPath('scripts/behavioral-factories.ts')).toBe('scripts/behavioral-factories.ts')
  })

  test('resolves workspace root from a nested repo directory', async () => {
    const workspaceRoot = await resolveWorkspaceRoot({ cwd: join(process.cwd(), 'scripts') })

    expect(workspaceRoot).toBe(process.cwd())
  })

  test('builds run directories inside the active workspace root', () => {
    const runDir = buildRunDir({ workspaceRoot: '/tmp/plaited-worktree', lane: 'behavioral-factories' })

    expect(runDir).toContain('/tmp/plaited-worktree/.prompts/autoresearch-runner/behavioral-factories/')
  })

  test('uses the Pi worktree guard extension', () => {
    expect(PI_WORKTREE_GUARD_EXTENSION_PATH).toBe('scripts/pi-worktree-guard-extension.ts')
  })

  test('passes the canonical repo root and extension into the Pi command', async () => {
    const config = await getLaneConfig('scripts/behavioral-factories.ts')

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
        path: 'dev-research/behavioral-factories/policies/search-policy.ts',
        writableRoots: ['dev-research/behavioral-factories'],
      }),
    ).toBe(true)

    expect(
      isAllowedPath({
        path: 'scripts/behavioral-factories.ts',
        writableRoots: ['dev-research/behavioral-factories'],
      }),
    ).toBe(false)
  })

  test('builds a retryable scope violation message for the lane agent', () => {
    const message = buildScopeViolationMessage({
      disallowedPaths: ['scripts/behavioral-factories.ts'],
      writableRoots: ['dev-research/behavioral-factories'],
    })

    expect(message).toContain('outside the allowed lane surface')
    expect(message).toContain('scripts/behavioral-factories.ts')
    expect(message).toContain('dev-research/behavioral-factories')
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
      laneKey: 'behavioral-factories',
      attempt: 2,
    })
    const head = (await (await Bun.$`git rev-parse HEAD`.cwd(root).quiet()).text()).trim()
    const log = await Bun.$`git log --oneline -1`.cwd(root).quiet()

    expect(commit).toHaveLength(40)
    expect(head).toBe(commit)
    expect(await log.text()).toContain('capture behavioral-factories attempt 02')

    await rm(root, { force: true, recursive: true })
  })

  test('writes a promotion summary for validated evaluated attempts', async () => {
    const root = await mkdtemp(join('/tmp', 'plaited-runner-promotion-'))
    const runDir = join(root, '.prompts', 'autoresearch-runner', 'behavioral-factories', 'run-1')
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
        changedPaths: ['dev-research/behavioral-factories/policies/a.ts'],
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
        changedPaths: ['dev-research/behavioral-factories/validation/b.ts'],
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
        metaVerification: { confidence: 0.7 },
      })}\n`,
    )
    await Bun.write(
      join(runDir, 'attempt-02', 'evaluation.json'),
      `${JSON.stringify({
        attempt: 2,
        pass: true,
        score: 0.91,
        reasoning: 'better',
        metaVerification: { confidence: 0.86 },
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
          key: 'behavioral-factories',
          scriptPath: 'scripts/behavioral-factories.ts',
          programPath: 'dev-research/behavioral-factories/program.md',
          validateCommand: ['bun', 'scripts/behavioral-factories.ts', 'validate'],
          writableRoots: ['dev-research/behavioral-factories'],
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
