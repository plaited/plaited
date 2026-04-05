import { afterEach, describe, expect, test } from 'bun:test'
import { unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { compareTrials } from '../compare-trials.ts'
import { bootstrap, mean, median } from '../compare-trials.utils.ts'

const tempFiles: string[] = []

const tempFile = (name: string): string => {
  const path = `${tmpdir()}/compare-trials-${Date.now()}-${name}`
  tempFiles.push(path)
  return path
}

afterEach(async () => {
  for (const file of tempFiles) {
    await unlink(file).catch(() => {})
  }
  tempFiles.length = 0
})

describe('compare-trials utils', () => {
  test('computes mean and median', () => {
    expect(mean([1, 2, 3])).toBe(2)
    expect(median([1, 3, 2])).toBe(2)
    expect(median([1, 2, 3, 4])).toBe(2.5)
  })

  test('bootstraps confidence intervals', () => {
    const [lower, upper] = bootstrap([0, 1, 1, 0], mean, { resamples: 100, confidence: 0.8 })

    expect(lower).toBeGreaterThanOrEqual(0)
    expect(upper).toBeLessThanOrEqual(1)
    expect(lower).toBeLessThanOrEqual(upper)
  })
})

describe('compareTrials', () => {
  test('compares two TrialResult JSONL files', async () => {
    const baselinePath = tempFile('baseline.jsonl')
    const challengerPath = tempFile('challenger.jsonl')

    await Bun.write(
      baselinePath,
      [
        JSON.stringify({
          id: 'p1',
          input: 'alpha',
          k: 1,
          trials: [{ trialNum: 1, output: 'a', duration: 10, pass: true }],
          passRate: 1,
          passAtK: 1,
          passExpK: 1,
        }),
        JSON.stringify({
          id: 'p2',
          input: 'beta',
          k: 1,
          trials: [{ trialNum: 1, output: 'b', duration: 20, pass: false }],
          passRate: 0,
          passAtK: 0,
          passExpK: 0,
        }),
      ].join('\n'),
    )

    await Bun.write(
      challengerPath,
      [
        JSON.stringify({
          id: 'p1',
          input: 'alpha',
          k: 1,
          trials: [{ trialNum: 1, output: 'a', duration: 12, pass: true }],
          passRate: 1,
          passAtK: 1,
          passExpK: 1,
        }),
        JSON.stringify({
          id: 'p2',
          input: 'beta',
          k: 1,
          trials: [{ trialNum: 1, output: 'b', duration: 18, pass: true }],
          passRate: 1,
          passAtK: 1,
          passExpK: 1,
        }),
      ].join('\n'),
    )

    const result = await compareTrials({
      baselinePath,
      challengerPath,
      baselineLabel: 'baseline',
      challengerLabel: 'challenger',
      resamples: 100,
      confidence: 0.8,
    })

    expect(result.summary.baselineWins).toBe(0)
    expect(result.summary.challengerWins).toBe(1)
    expect(result.summary.totalPrompts).toBe(2)
    expect(result.baseline.avgPassRate).toBe(0.5)
    expect(result.challenger.avgPassRate).toBe(1)
  })
})
