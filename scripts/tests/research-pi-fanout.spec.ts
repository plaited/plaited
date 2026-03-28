import { describe, expect, test } from 'bun:test'
import {
  buildScopeViolationMessage,
  buildStrategyNotes,
  DEFAULT_ATTEMPT_BUDGET,
  DEFAULT_INITIAL_CONCURRENT_ATTEMPTS,
  getProgramConfig,
  isAllowedPath,
  parseRunArgs,
} from '../research-pi-fanout.ts'

describe('research-pi-fanout', () => {
  test('builds one strategy note per attempt', () => {
    const notes = buildStrategyNotes(7)

    expect(notes).toHaveLength(7)
    expect(notes[0]).toContain('coverage-first')
  })

  test('returns program config for default hypergraph', () => {
    const config = getProgramConfig('default-hypergraph')

    expect(config.programPath).toBe('dev-research/default-hypergraph/program.md')
    expect(config.validateCommand).toEqual(['bun', 'scripts/default-hypergraph.ts', 'validate'])
    expect(config.skills.length).toBeGreaterThan(0)
    expect(config.writableRoots).toEqual(['dev-research/default-hypergraph'])
  })

  test('default hypergraph fanout keeps lane-local writes and includes search capability', () => {
    const config = getProgramConfig('default-hypergraph')

    expect(config.writableRoots).toEqual(['dev-research/default-hypergraph'])
    expect(config.skills).toContain('skills/youdotcom-api')
  })

  test('parses run arguments with defaults', () => {
    const parsed = parseRunArgs(['default-hypergraph'])

    expect(parsed.program).toBe('default-hypergraph')
    expect(parsed.command).toBe('run')
    expect(parsed.attempts).toBe(DEFAULT_ATTEMPT_BUDGET)
    expect(parsed.concurrency).toBe(DEFAULT_INITIAL_CONCURRENT_ATTEMPTS)
    expect(parsed.runDir).toBeNull()
  })

  test('parses explicit status arguments', () => {
    const parsed = parseRunArgs([
      'behavioral-factories',
      'status',
      '--attempts',
      '9',
      '--concurrency',
      '3',
      '--run-dir',
      '/tmp/research-run',
    ])

    expect(parsed.program).toBe('behavioral-factories')
    expect(parsed.command).toBe('status')
    expect(parsed.attempts).toBe(9)
    expect(parsed.concurrency).toBe(3)
    expect(parsed.runDir).toBe('/tmp/research-run')
  })

  test('allowed-path enforcement accepts only configured writable roots', () => {
    expect(
      isAllowedPath({
        path: 'dev-research/default-hypergraph/seed/mss.jsonld',
        writableRoots: ['dev-research/default-hypergraph'],
      }),
    ).toBe(true)

    expect(
      isAllowedPath({
        path: 'scripts/default-hypergraph.ts',
        writableRoots: ['dev-research/default-hypergraph'],
      }),
    ).toBe(false)

    expect(
      isAllowedPath({
        path: 'skills/mss/SKILL.md',
        writableRoots: ['dev-research/default-hypergraph'],
      }),
    ).toBe(false)
  })

  test('builds a retryable scope violation message for the agent', () => {
    const message = buildScopeViolationMessage({
      disallowedPaths: ['scripts/default-hypergraph.ts'],
      writableRoots: ['dev-research/default-hypergraph'],
    })

    expect(message).toContain('modified files outside the allowed program surface')
    expect(message).toContain('scripts/default-hypergraph.ts')
    expect(message).toContain('dev-research/default-hypergraph')
  })
})
