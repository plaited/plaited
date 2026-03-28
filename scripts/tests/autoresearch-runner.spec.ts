import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  buildRunDir,
  buildScopeViolationMessage,
  buildStrategyNotes,
  getLaneConfig,
  isAllowedPath,
  MAX_ATTEMPT_RETRIES,
  normalizeScriptPath,
  parseRunArgs,
  resolveWorkspaceRoot,
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
    expect(config.defaultAttempts).toBe(15)
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
    expect(parsed.attempts).toBe(15)
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
})
