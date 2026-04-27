import { describe, expect, test } from 'bun:test'
import { normalizeResearchPromptResult } from '../research.grading.utils.ts'

const trial = ({ duration, pass, trialNum }: { duration: number; pass?: boolean; trialNum: number }) => {
  const base = {
    trialNum,
    output: pass === undefined ? 'unknown' : pass ? 'ok' : 'fail',
    duration,
  }
  if (pass === undefined) {
    return base
  }
  return {
    ...base,
    pass,
    score: pass ? 1 : 0,
  }
}

describe('normalizeResearchPromptResult', () => {
  test('derives pass metrics from full trials[].pass coverage using canonical formulas', () => {
    const normalized = normalizeResearchPromptResult({
      id: 'p1',
      input: 'alpha',
      trials: [trial({ trialNum: 1, pass: true, duration: 10 }), trial({ trialNum: 2, pass: false, duration: 10 })],
    })

    expect(normalized.comparisonEligible).toBe(true)
    expect(normalized.passEvidenceCoverage).toBe('full')
    expect(normalized.passEvidenceCount).toBe(2)
    expect(normalized.result.passRate).toBe(0.5)
    expect(normalized.result.passAtK).toBe(0.75)
    expect(normalized.result.passExpK).toBe(0.25)
  })

  test('ignores cached aggregates when full trial evidence exists', () => {
    const normalized = normalizeResearchPromptResult({
      id: 'p1',
      input: 'alpha',
      passRate: 0,
      passAtK: 0,
      passExpK: 0,
      trials: [trial({ trialNum: 1, pass: true, duration: 10 }), trial({ trialNum: 2, pass: true, duration: 10 })],
    })

    expect(normalized.comparisonEligible).toBe(true)
    expect(normalized.result.passRate).toBe(1)
    expect(normalized.result.passAtK).toBe(1)
    expect(normalized.result.passExpK).toBe(1)
  })

  test('marks partial pass/fail coverage as non-comparable', () => {
    const normalized = normalizeResearchPromptResult({
      id: 'p1',
      input: 'alpha',
      passRate: 1,
      passAtK: 1,
      passExpK: 1,
      trials: [trial({ trialNum: 1, pass: true, duration: 10 }), trial({ trialNum: 2, duration: 10 })],
    })

    expect(normalized.comparisonEligible).toBe(false)
    expect(normalized.passEvidenceCoverage).toBe('partial')
    expect(normalized.passEvidenceCount).toBe(1)
    expect(normalized.result.passRate).toBeUndefined()
    expect(normalized.result.passAtK).toBeUndefined()
    expect(normalized.result.passExpK).toBeUndefined()
  })

  test('marks zero pass/fail coverage as non-comparable', () => {
    const normalized = normalizeResearchPromptResult({
      id: 'p1',
      input: 'alpha',
      passRate: 1,
      passAtK: 1,
      passExpK: 1,
      trials: [trial({ trialNum: 1, duration: 10 })],
    })

    expect(normalized.comparisonEligible).toBe(false)
    expect(normalized.passEvidenceCoverage).toBe('none')
    expect(normalized.passEvidenceCount).toBe(0)
    expect(normalized.result.passRate).toBeUndefined()
    expect(normalized.result.passAtK).toBeUndefined()
    expect(normalized.result.passExpK).toBeUndefined()
  })
})
