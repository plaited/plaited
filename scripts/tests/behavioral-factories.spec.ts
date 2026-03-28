import { describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import {
  BEHAVIORAL_FACTORIES_PROGRAM_PATH,
  BEHAVIORAL_FACTORIES_SYSTEM_PROMPT,
  getBehavioralFactoriesStatus,
  isBehavioralFactoriesValid,
  RESEARCH_LANE_CONFIG,
  renderBehavioralFactoriesStatus,
  resolveWorkspaceRoot,
} from '../behavioral-factories.ts'

describe('behavioral-factories script', () => {
  test('reports the configured program path', async () => {
    const status = await getBehavioralFactoriesStatus()

    expect(status.programPath).toBe(BEHAVIORAL_FACTORIES_PROGRAM_PATH)
  })

  test('renders a readable status block', async () => {
    const status = await getBehavioralFactoriesStatus()
    const output = renderBehavioralFactoriesStatus(status)

    expect(output).toContain('program: behavioral-factories')
    expect(output).toContain(`programPath: ${BEHAVIORAL_FACTORIES_PROGRAM_PATH}`)
    expect(output).toContain('outputRoot:')
    expect(output).toContain('requirements:')
  })

  test('validates against the current repo state', async () => {
    const status = await getBehavioralFactoriesStatus()

    expect(isBehavioralFactoriesValid(status)).toBe(true)
  })

  test('resolves workspace root from a nested repo directory', async () => {
    const workspaceRoot = await resolveWorkspaceRoot({ cwd: join(process.cwd(), 'scripts') })

    expect(workspaceRoot).toBe(process.cwd())
  })

  test('exports an autoresearch lane config', () => {
    expect(RESEARCH_LANE_CONFIG.scriptPath).toBe('scripts/behavioral-factories.ts')
    expect(RESEARCH_LANE_CONFIG.validateCommand).toEqual(['bun', 'scripts/behavioral-factories.ts', 'validate'])
    expect(RESEARCH_LANE_CONFIG.writableRoots).toEqual(['dev-research/behavioral-factories'])
    expect(RESEARCH_LANE_CONFIG.defaultAttempts).toBe(20)
    expect(RESEARCH_LANE_CONFIG.defaultParallelism).toBe(3)
    expect(RESEARCH_LANE_CONFIG.systemPrompt).toBe(BEHAVIORAL_FACTORIES_SYSTEM_PROMPT)
    expect(RESEARCH_LANE_CONFIG.evaluation?.graderPath).toBe('scripts/behavioral-factories-grader.ts')
    expect(RESEARCH_LANE_CONFIG.evaluation?.verifierPath).toBe('scripts/behavioral-factories-verifier.ts')
    expect(RESEARCH_LANE_CONFIG.evaluation?.useMetaVerification).toBe(true)
  })
})
