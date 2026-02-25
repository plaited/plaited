/**
 * Unit tests for trials comparison module.
 *
 * @remarks
 * Tests for runTrialsCompare and supporting functions.
 *
 * @packageDocumentation
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { buildTrialsIndex, runTrialsCompare } from '../compare-trials.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const createTrialResult = (
  id: string,
  passAtK: number,
  passExpK: number,
  k: number = 3,
  includeScores: boolean = true,
) => ({
  id,
  input: `Prompt for ${id}`,
  k,
  ...(includeScores && { passRate: passAtK, passAtK, passExpK }),
  trials: Array.from({ length: k }, (_, i) => ({
    trialNum: i + 1,
    output: `Output ${i + 1}`,
    trajectory: [],
    duration: 100 + i * 10,
    ...(includeScores && { pass: Math.random() < passAtK, score: passAtK }),
  })),
})

const tempDir = `${import.meta.dir}/.test-tmp/compare-trials`

beforeAll(async () => {
  await Bun.$`mkdir -p ${tempDir}`
})

afterAll(async () => {
  await Bun.$`rm -rf ${tempDir}`
})

// ============================================================================
// buildTrialsIndex Tests
// ============================================================================

describe('buildTrialsIndex', () => {
  test('builds index from JSONL file', async () => {
    const path = `${tempDir}/trials-index.jsonl`
    const trial1 = createTrialResult('test-001', 0.9, 0.3)
    const trial2 = createTrialResult('test-002', 0.8, 0.6)
    await Bun.write(path, [JSON.stringify(trial1), JSON.stringify(trial2)].join('\n'))

    const index = await buildTrialsIndex(path)

    expect(index.size).toBe(2)
    expect(index.get('test-001')?.passAtK).toBe(0.9)
    expect(index.get('test-002')?.passExpK).toBe(0.6)
  })

  test('handles empty file', async () => {
    const path = `${tempDir}/empty-trials.jsonl`
    await Bun.write(path, '')

    const index = await buildTrialsIndex(path)

    expect(index.size).toBe(0)
  })

  test('throws on invalid JSON', async () => {
    const path = `${tempDir}/invalid-trials.jsonl`
    await Bun.write(path, 'not json\n')

    await expect(buildTrialsIndex(path)).rejects.toThrow()
  })
})

// ============================================================================
// runTrialsCompare Tests
// ============================================================================

describe('runTrialsCompare', () => {
  test('compares two trial runs and produces report', async () => {
    const run1Path = `${tempDir}/run1.jsonl`
    const run2Path = `${tempDir}/run2.jsonl`

    const trial1a = createTrialResult('test-001', 0.9, 0.7)
    const trial1b = createTrialResult('test-002', 0.8, 0.5)
    const trial2a = createTrialResult('test-001', 0.95, 0.9)
    const trial2b = createTrialResult('test-002', 0.6, 0.4)

    await Bun.write(run1Path, [JSON.stringify(trial1a), JSON.stringify(trial1b)].join('\n'))
    await Bun.write(run2Path, [JSON.stringify(trial2a), JSON.stringify(trial2b)].join('\n'))

    const outputPath = `${tempDir}/comparison.json`
    const report = await runTrialsCompare({
      runs: [
        { label: 'baseline', path: run1Path },
        { label: 'variant', path: run2Path },
      ],
      outputPath,
      progress: false,
    })

    expect(report.meta.inputFormat).toBe('trials')
    expect(report.meta.runs).toEqual(['baseline', 'variant'])
    expect(report.meta.promptCount).toBe(2)
    expect(report.capability).toBeDefined()
    expect(report.reliability).toBeDefined()
    expect(report.reliability.baseline?.type).toBe('trial')
    expect(report.reliability.variant?.type).toBe('trial')
    expect(report.flakiness).toBeDefined()
    expect(report.headToHead.capability.length).toBeGreaterThan(0)

    // Verify output file was written
    const outputExists = await Bun.file(outputPath).exists()
    expect(outputExists).toBe(true)
  })

  test('throws with fewer than 2 runs', async () => {
    const run1Path = `${tempDir}/single-run.jsonl`
    await Bun.write(run1Path, JSON.stringify(createTrialResult('test-001', 0.9, 0.7)))

    await expect(
      runTrialsCompare({
        runs: [{ label: 'only', path: run1Path }],
        progress: false,
      }),
    ).rejects.toThrow('At least 2 runs required')
  })

  test('skips prompts only in one run', async () => {
    const run1Path = `${tempDir}/partial1.jsonl`
    const run2Path = `${tempDir}/partial2.jsonl`

    // Only run1 has test-001
    const trial1a = createTrialResult('test-001', 0.9, 0.7)
    // Both have test-002
    const trial1b = createTrialResult('test-002', 0.8, 0.5)
    const trial2b = createTrialResult('test-002', 0.6, 0.4)

    await Bun.write(run1Path, [JSON.stringify(trial1a), JSON.stringify(trial1b)].join('\n'))
    await Bun.write(run2Path, JSON.stringify(trial2b))

    const report = await runTrialsCompare({
      runs: [
        { label: 'run1', path: run1Path },
        { label: 'run2', path: run2Path },
      ],
      progress: false,
    })

    // Only test-002 should be compared (both runs have it)
    expect(report.headToHead.overall.length).toBeGreaterThan(0)
    // Per-prompt should only have test-002
    const perPromptIds = report.perPrompt?.map((p) => p.id) ?? []
    expect(perPromptIds).toContain('test-002')
    expect(perPromptIds).not.toContain('test-001')
  })

  test('generates markdown output when format is markdown', async () => {
    const run1Path = `${tempDir}/md-run1.jsonl`
    const run2Path = `${tempDir}/md-run2.jsonl`
    const outputPath = `${tempDir}/report.md`

    const trial1 = createTrialResult('test-001', 0.9, 0.7)
    const trial2 = createTrialResult('test-001', 0.8, 0.6)

    await Bun.write(run1Path, JSON.stringify(trial1))
    await Bun.write(run2Path, JSON.stringify(trial2))

    await runTrialsCompare({
      runs: [
        { label: 'agent1', path: run1Path },
        { label: 'agent2', path: run2Path },
      ],
      outputPath,
      format: 'markdown',
      progress: false,
    })

    const content = await Bun.file(outputPath).text()
    expect(content).toContain('# Trials Comparison Report')
    expect(content).toContain('## Capability')
    expect(content).toContain('## Reliability')
    expect(content).toContain('## Flakiness')
    expect(content).toContain('agent1')
    expect(content).toContain('agent2')
  })

  test('uses statistical strategy when specified', async () => {
    const run1Path = `${tempDir}/stat-run1.jsonl`
    const run2Path = `${tempDir}/stat-run2.jsonl`

    const trial1 = createTrialResult('test-001', 0.9, 0.7)
    const trial2 = createTrialResult('test-001', 0.5, 0.3)

    await Bun.write(run1Path, JSON.stringify(trial1))
    await Bun.write(run2Path, JSON.stringify(trial2))

    const report = await runTrialsCompare({
      runs: [
        { label: 'better', path: run1Path },
        { label: 'worse', path: run2Path },
      ],
      strategy: 'statistical',
      progress: false,
    })

    // Report should be generated without error
    expect(report.meta.runs).toEqual(['better', 'worse'])
  })

  test('statistical strategy computes confidence intervals for capability metrics', async () => {
    const run1Path = `${tempDir}/ci-cap-run1.jsonl`
    const run2Path = `${tempDir}/ci-cap-run2.jsonl`

    // Create multiple prompts for meaningful CI computation
    const trials1 = [
      createTrialResult('p1', 0.9, 0.8),
      createTrialResult('p2', 0.85, 0.7),
      createTrialResult('p3', 0.95, 0.9),
    ]
    const trials2 = [
      createTrialResult('p1', 0.6, 0.4),
      createTrialResult('p2', 0.5, 0.3),
      createTrialResult('p3', 0.7, 0.5),
    ]

    await Bun.write(run1Path, trials1.map((t) => JSON.stringify(t)).join('\n'))
    await Bun.write(run2Path, trials2.map((t) => JSON.stringify(t)).join('\n'))

    const report = await runTrialsCompare({
      runs: [
        { label: 'high', path: run1Path },
        { label: 'low', path: run2Path },
      ],
      strategy: 'statistical',
      progress: false,
    })

    // Verify confidence intervals are computed for capability
    const highCap = report.capability.high
    expect(highCap).toBeDefined()
    expect(highCap?.confidenceIntervals).toBeDefined()
    expect(highCap?.confidenceIntervals?.avgPassAtK).toBeDefined()

    // CI should be a tuple [lower, upper]
    const ci = highCap?.confidenceIntervals?.avgPassAtK
    expect(ci).toHaveLength(2)
    expect(ci?.[0]).toBeLessThanOrEqual(ci?.[1] ?? 0)

    // CI should contain the average (within reasonable bounds)
    expect(ci?.[0]).toBeLessThanOrEqual(highCap?.avgPassAtK ?? 0)
    expect(ci?.[1]).toBeGreaterThanOrEqual(highCap?.avgPassAtK ?? 1)
  })

  test('statistical strategy computes confidence intervals for reliability metrics', async () => {
    const run1Path = `${tempDir}/ci-rel-run1.jsonl`
    const run2Path = `${tempDir}/ci-rel-run2.jsonl`

    const trials1 = [
      createTrialResult('p1', 0.9, 0.85),
      createTrialResult('p2', 0.8, 0.75),
      createTrialResult('p3', 0.85, 0.8),
    ]
    const trials2 = [
      createTrialResult('p1', 0.7, 0.3),
      createTrialResult('p2', 0.6, 0.2),
      createTrialResult('p3', 0.65, 0.25),
    ]

    await Bun.write(run1Path, trials1.map((t) => JSON.stringify(t)).join('\n'))
    await Bun.write(run2Path, trials2.map((t) => JSON.stringify(t)).join('\n'))

    const report = await runTrialsCompare({
      runs: [
        { label: 'reliable', path: run1Path },
        { label: 'flaky', path: run2Path },
      ],
      strategy: 'statistical',
      progress: false,
    })

    // Verify confidence intervals are computed for reliability
    const reliableRel = report.reliability.reliable
    expect(reliableRel).toBeDefined()
    expect(reliableRel?.type).toBe('trial')
    expect(reliableRel?.confidenceIntervals).toBeDefined()
    expect(reliableRel?.confidenceIntervals?.avgPassExpK).toBeDefined()

    // CI should be a tuple [lower, upper]
    const ci = reliableRel?.confidenceIntervals?.avgPassExpK
    expect(ci).toHaveLength(2)
    expect(ci?.[0]).toBeLessThanOrEqual(ci?.[1] ?? 0)
  })

  test('weighted strategy does not compute confidence intervals', async () => {
    const run1Path = `${tempDir}/no-ci-run1.jsonl`
    const run2Path = `${tempDir}/no-ci-run2.jsonl`

    const trial1 = createTrialResult('test-001', 0.9, 0.7)
    const trial2 = createTrialResult('test-001', 0.5, 0.3)

    await Bun.write(run1Path, JSON.stringify(trial1))
    await Bun.write(run2Path, JSON.stringify(trial2))

    const report = await runTrialsCompare({
      runs: [
        { label: 'run1', path: run1Path },
        { label: 'run2', path: run2Path },
      ],
      strategy: 'weighted', // Default strategy
      progress: false,
    })

    // Confidence intervals should NOT be present for weighted strategy
    const cap = report.capability.run1
    expect(cap?.confidenceIntervals).toBeUndefined()

    const rel = report.reliability.run1
    expect(rel?.confidenceIntervals).toBeUndefined()
  })

  test('statistical strategy includes CIs in markdown output', async () => {
    const run1Path = `${tempDir}/ci-md-run1.jsonl`
    const run2Path = `${tempDir}/ci-md-run2.jsonl`
    const outputPath = `${tempDir}/ci-report.md`

    const trials1 = [createTrialResult('p1', 0.9, 0.8), createTrialResult('p2', 0.85, 0.75)]
    const trials2 = [createTrialResult('p1', 0.6, 0.4), createTrialResult('p2', 0.5, 0.3)]

    await Bun.write(run1Path, trials1.map((t) => JSON.stringify(t)).join('\n'))
    await Bun.write(run2Path, trials2.map((t) => JSON.stringify(t)).join('\n'))

    await runTrialsCompare({
      runs: [
        { label: 'agent1', path: run1Path },
        { label: 'agent2', path: run2Path },
      ],
      strategy: 'statistical',
      outputPath,
      format: 'markdown',
      progress: false,
    })

    const content = await Bun.file(outputPath).text()

    // Markdown should include 95% CI column headers
    expect(content).toContain('95% CI')
    // Should contain CI values in bracket format [lower, upper]
    expect(content).toMatch(/\[\d+\.\d+, \d+\.\d+\]/)
  })

  test('computes correct capability metrics', async () => {
    const run1Path = `${tempDir}/cap-run1.jsonl`

    // Create 3 prompts with known passAtK values
    const trials = [
      createTrialResult('p1', 1.0, 0.8), // passAtK = 1.0
      createTrialResult('p2', 0.5, 0.3), // passAtK = 0.5
      createTrialResult('p3', 0.8, 0.6), // passAtK = 0.8
    ]
    // Average passAtK = (1.0 + 0.5 + 0.8) / 3 = 0.767
    // Sorted: 0.5, 0.8, 1.0 -> median = 0.8

    await Bun.write(run1Path, trials.map((t) => JSON.stringify(t)).join('\n'))

    const run2Path = `${tempDir}/cap-run2.jsonl`
    await Bun.write(run2Path, trials.map((t) => JSON.stringify(t)).join('\n'))

    const report = await runTrialsCompare({
      runs: [
        { label: 'test', path: run1Path },
        { label: 'test2', path: run2Path },
      ],
      progress: false,
    })

    const cap = report.capability.test
    expect(cap).toBeDefined()
    // Average should be approximately 0.767
    expect(cap?.avgPassAtK).toBeCloseTo(0.767, 2)
    // Median of [0.5, 0.8, 1.0] = 0.8
    expect(cap?.medianPassAtK).toBeCloseTo(0.8, 2)
  })

  test('identifies flaky prompts correctly', async () => {
    const run1Path = `${tempDir}/flaky-run1.jsonl`

    // Create prompts with varying flakiness
    const trials = [
      createTrialResult('consistent', 0.9, 0.9), // flakiness = 0
      createTrialResult('flaky', 0.9, 0.1), // flakiness = 0.8
      createTrialResult('moderate', 0.7, 0.5), // flakiness = 0.2
    ]

    await Bun.write(run1Path, trials.map((t) => JSON.stringify(t)).join('\n'))

    const run2Path = `${tempDir}/flaky-run2.jsonl`
    await Bun.write(run2Path, trials.map((t) => JSON.stringify(t)).join('\n'))

    const report = await runTrialsCompare({
      runs: [
        { label: 'test', path: run1Path },
        { label: 'test2', path: run2Path },
      ],
      progress: false,
    })

    const flak = report.flakiness.test
    expect(flak).toBeDefined()
    // 2 prompts have non-zero flakiness
    expect(flak?.flakyPromptCount).toBe(2)
    // Top flaky should include 'flaky' prompt
    const topFlakyIds = flak?.topFlakyPrompts.map((p) => p.id) ?? []
    expect(topFlakyIds).toContain('flaky')
  })

  test('includes performance metrics with latency stats', async () => {
    const run1Path = `${tempDir}/perf-run1.jsonl`
    const run2Path = `${tempDir}/perf-run2.jsonl`

    const trial1 = createTrialResult('test-001', 0.9, 0.7)
    const trial2 = createTrialResult('test-001', 0.8, 0.6)

    await Bun.write(run1Path, JSON.stringify(trial1))
    await Bun.write(run2Path, JSON.stringify(trial2))

    const report = await runTrialsCompare({
      runs: [
        { label: 'run1', path: run1Path },
        { label: 'run2', path: run2Path },
      ],
      progress: false,
    })

    // Performance should always be present
    expect(report.performance).toBeDefined()
    expect(report.performance.run1).toBeDefined()
    expect(report.performance.run2).toBeDefined()

    const perf = report.performance.run1
    expect(perf?.latency).toBeDefined()
    expect(perf?.latency.p50).toBeGreaterThan(0)
    expect(perf?.latency.mean).toBeGreaterThan(0)
    expect(perf?.latency.min).toBeGreaterThan(0)
    expect(perf?.latency.max).toBeGreaterThan(0)
    expect(perf?.totalDuration).toBeGreaterThan(0)
  })

  test('includes quality metrics when scores are present', async () => {
    const run1Path = `${tempDir}/qual-run1.jsonl`
    const run2Path = `${tempDir}/qual-run2.jsonl`

    // createTrialResult always includes score fields
    const trial1 = createTrialResult('test-001', 0.9, 0.7)
    const trial2 = createTrialResult('test-001', 0.8, 0.6)

    await Bun.write(run1Path, JSON.stringify(trial1))
    await Bun.write(run2Path, JSON.stringify(trial2))

    const report = await runTrialsCompare({
      runs: [
        { label: 'run1', path: run1Path },
        { label: 'run2', path: run2Path },
      ],
      progress: false,
    })

    // Quality should be present since trials have scores
    expect(report.quality).toBeDefined()
    expect(report.quality?.run1).toBeDefined()

    const qual = report.quality?.run1
    expect(qual?.type).toBe('trial')
    expect(qual?.avgScore).toBeGreaterThan(0)
    expect(qual?.medianScore).toBeGreaterThan(0)
    expect(qual?.p25Score).toBeDefined()
    expect(qual?.p75Score).toBeDefined()
  })

  test('omits quality metrics when scores are absent', async () => {
    const run1Path = `${tempDir}/noqual-run1.jsonl`
    const run2Path = `${tempDir}/noqual-run2.jsonl`

    // Create trials without scores (includeScores=false)
    const trial1 = createTrialResult('test-001', 0, 0, 3, false)
    const trial2 = createTrialResult('test-001', 0, 0, 3, false)

    await Bun.write(run1Path, JSON.stringify(trial1))
    await Bun.write(run2Path, JSON.stringify(trial2))

    const report = await runTrialsCompare({
      runs: [
        { label: 'run1', path: run1Path },
        { label: 'run2', path: run2Path },
      ],
      progress: false,
    })

    // Quality should NOT be present since no trials have scores
    expect(report.quality).toBeUndefined()

    // Performance should still be present
    expect(report.performance).toBeDefined()
    expect(report.performance.run1?.latency.mean).toBeGreaterThan(0)
  })

  test('statistical strategy computes CIs for quality and performance', async () => {
    const run1Path = `${tempDir}/ci-qp-run1.jsonl`
    const run2Path = `${tempDir}/ci-qp-run2.jsonl`

    const trials1 = [
      createTrialResult('p1', 0.9, 0.8),
      createTrialResult('p2', 0.85, 0.7),
      createTrialResult('p3', 0.95, 0.9),
    ]
    const trials2 = [
      createTrialResult('p1', 0.6, 0.4),
      createTrialResult('p2', 0.5, 0.3),
      createTrialResult('p3', 0.7, 0.5),
    ]

    await Bun.write(run1Path, trials1.map((t) => JSON.stringify(t)).join('\n'))
    await Bun.write(run2Path, trials2.map((t) => JSON.stringify(t)).join('\n'))

    const report = await runTrialsCompare({
      runs: [
        { label: 'high', path: run1Path },
        { label: 'low', path: run2Path },
      ],
      strategy: 'statistical',
      progress: false,
    })

    // Quality CIs
    const highQual = report.quality?.high
    expect(highQual).toBeDefined()
    expect(highQual?.confidenceIntervals).toBeDefined()
    expect(highQual?.confidenceIntervals?.avgScore).toBeDefined()

    const qualCI = highQual?.confidenceIntervals?.avgScore
    expect(qualCI).toHaveLength(2)
    expect(qualCI?.[0]).toBeLessThanOrEqual(qualCI?.[1] ?? 0)

    // Performance CIs
    const highPerf = report.performance.high
    expect(highPerf).toBeDefined()
    expect(highPerf?.confidenceIntervals).toBeDefined()
    expect(highPerf?.confidenceIntervals?.latencyMean).toBeDefined()

    const perfCI = highPerf?.confidenceIntervals?.latencyMean
    expect(perfCI).toHaveLength(2)
    expect(perfCI?.[0]).toBeLessThanOrEqual(perfCI?.[1] ?? 0)
  })

  test('markdown output includes quality and performance tables', async () => {
    const run1Path = `${tempDir}/md-qp-run1.jsonl`
    const run2Path = `${tempDir}/md-qp-run2.jsonl`
    const outputPath = `${tempDir}/qp-report.md`

    const trial1 = createTrialResult('test-001', 0.9, 0.7)
    const trial2 = createTrialResult('test-001', 0.8, 0.6)

    await Bun.write(run1Path, JSON.stringify(trial1))
    await Bun.write(run2Path, JSON.stringify(trial2))

    await runTrialsCompare({
      runs: [
        { label: 'agent1', path: run1Path },
        { label: 'agent2', path: run2Path },
      ],
      outputPath,
      format: 'markdown',
      progress: false,
    })

    const content = await Bun.file(outputPath).text()

    // Should contain quality and performance sections
    expect(content).toContain('## Quality (Scores)')
    expect(content).toContain('## Performance (Latency)')
    expect(content).toContain('Avg Score')
    expect(content).toContain('P50 (ms)')
    expect(content).toContain('Mean (ms)')
  })
})
