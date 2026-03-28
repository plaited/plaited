import { describe, expect, test } from 'bun:test'
import { buildStrategyNotes, getProgramConfig, parseRunArgs } from '../research-pi-fanout.ts'

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
  })

  test('parses run arguments with defaults', () => {
    const parsed = parseRunArgs(['default-hypergraph'])

    expect(parsed.program).toBe('default-hypergraph')
    expect(parsed.command).toBe('run')
    expect(parsed.attempts).toBe(5)
    expect(parsed.concurrency).toBe(2)
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
})
