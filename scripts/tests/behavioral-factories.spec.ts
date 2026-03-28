import { describe, expect, test } from 'bun:test'
import {
  BEHAVIORAL_FACTORIES_PROGRAM_PATH,
  getBehavioralFactoriesStatus,
  isBehavioralFactoriesValid,
  renderBehavioralFactoriesStatus,
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
    expect(output).toContain('requirements:')
  })

  test('validates against the current repo state', async () => {
    const status = await getBehavioralFactoriesStatus()

    expect(isBehavioralFactoriesValid(status)).toBe(true)
  })
})
