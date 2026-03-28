import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  BEHAVIORAL_CORPUS_ENCODED_PATH,
  BEHAVIORAL_CORPUS_PROGRAM_PATH,
  BEHAVIORAL_SEED_PATH,
  getBehavioralCorpusStatus,
  isBehavioralCorpusValid,
  RESEARCH_LANE_CONFIG,
  renderBehavioralCorpusStatus,
  resolveWorkspaceRoot,
} from '../behavioral-corpus.ts'

describe('behavioral-corpus script', () => {
  test('reports the configured program path', async () => {
    const status = await getBehavioralCorpusStatus()

    expect(status.programPath).toBe(BEHAVIORAL_CORPUS_PROGRAM_PATH)
  })

  test('renders a readable status block', async () => {
    const status = await getBehavioralCorpusStatus()
    const output = renderBehavioralCorpusStatus(status)

    expect(output).toContain('program: behavioral-corpus')
    expect(output).toContain(`programPath: ${BEHAVIORAL_CORPUS_PROGRAM_PATH}`)
    expect(output).toContain(`seedPath: ${BEHAVIORAL_SEED_PATH}`)
    expect(output).toContain(`encodedPath: ${BEHAVIORAL_CORPUS_ENCODED_PATH}`)
    expect(output).toContain('requirements:')
  })

  test('validates against the current repo state', async () => {
    const status = await getBehavioralCorpusStatus()

    expect(status.programExists).toBe(true)
    expect(status.programNonEmpty).toBe(true)
    expect(isBehavioralCorpusValid(status)).toBe(false)
  })

  test('resolves workspace root from a nested repo directory', async () => {
    const workspaceRoot = await resolveWorkspaceRoot({ cwd: join(process.cwd(), 'scripts') })

    expect(workspaceRoot).toBe(process.cwd())
  })

  test('exports an autoresearch lane config', () => {
    expect(RESEARCH_LANE_CONFIG.scriptPath).toBe('scripts/behavioral-corpus.ts')
    expect(RESEARCH_LANE_CONFIG.validateCommand).toEqual(['bun', 'scripts/behavioral-corpus.ts', 'validate'])
    expect(RESEARCH_LANE_CONFIG.writableRoots).toEqual(['dev-research/behavioral-corpus'])
    expect(RESEARCH_LANE_CONFIG.defaultAttempts).toBe(20)
    expect(RESEARCH_LANE_CONFIG.defaultParallelism).toBe(3)
  })
})
