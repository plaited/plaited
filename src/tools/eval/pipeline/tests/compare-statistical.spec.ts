/**
 * Integration tests for compare command statistical strategy.
 *
 * @remarks
 * Tests verify confidence interval computation for the statistical strategy
 * in the compare command with CaptureResult format.
 *
 * @packageDocumentation
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import type { CaptureResult } from '../../schemas.ts'
import { runCompare } from '../compare.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const createCaptureResult = (id: string, score: number, pass: boolean, duration: number = 1000): CaptureResult => ({
  id,
  input: `Prompt for ${id}`,
  output: `Output for ${id}`,
  trajectory: [{ type: 'message', content: `Output for ${id}`, timestamp: Date.now() }],
  metadata: {},
  timing: {
    start: Date.now(),
    end: Date.now() + duration,
    sessionCreation: 100,
    total: duration,
  },
  toolErrors: false,
  score: {
    pass,
    score,
    reasoning: pass ? 'Passed' : 'Failed',
  },
})

const tempDir = `${import.meta.dir}/.test-tmp/compare-statistical`

beforeAll(async () => {
  await Bun.$`mkdir -p ${tempDir}`
})

afterAll(async () => {
  await Bun.$`rm -rf ${tempDir}`
})

// ============================================================================
// Statistical Strategy CI Tests
// ============================================================================

describe('runCompare statistical strategy', () => {
  test('computes confidence intervals for quality metrics', async () => {
    const run1Path = `${tempDir}/ci-qual-run1.jsonl`
    const run2Path = `${tempDir}/ci-qual-run2.jsonl`

    // Create multiple prompts with varying scores for meaningful CI computation
    const results1 = [
      createCaptureResult('p1', 0.9, true, 1000),
      createCaptureResult('p2', 0.85, true, 1100),
      createCaptureResult('p3', 0.95, true, 900),
      createCaptureResult('p4', 0.8, true, 1200),
    ]
    const results2 = [
      createCaptureResult('p1', 0.6, false, 2000),
      createCaptureResult('p2', 0.5, false, 2100),
      createCaptureResult('p3', 0.7, true, 1900),
      createCaptureResult('p4', 0.55, false, 2200),
    ]

    await Bun.write(run1Path, results1.map((r) => JSON.stringify(r)).join('\n'))
    await Bun.write(run2Path, results2.map((r) => JSON.stringify(r)).join('\n'))

    const report = await runCompare({
      runs: [
        { label: 'high', path: run1Path },
        { label: 'low', path: run2Path },
      ],
      strategy: 'statistical',
      progress: false,
    })

    // Verify confidence intervals are computed for quality
    const highQuality = report.quality.high
    expect(highQuality).toBeDefined()
    expect(highQuality?.confidenceIntervals).toBeDefined()
    expect(highQuality?.confidenceIntervals?.avgScore).toBeDefined()
    expect(highQuality?.confidenceIntervals?.passRate).toBeDefined()

    // avgScore CI should be a tuple [lower, upper]
    const avgScoreCI = highQuality?.confidenceIntervals?.avgScore
    expect(avgScoreCI).toHaveLength(2)
    expect(avgScoreCI?.[0]).toBeLessThanOrEqual(avgScoreCI?.[1] ?? 0)

    // CI should contain the average (within reasonable bounds)
    expect(avgScoreCI?.[0]).toBeLessThanOrEqual(highQuality?.avgScore ?? 0)
    expect(avgScoreCI?.[1]).toBeGreaterThanOrEqual(highQuality?.avgScore ?? 1)

    // passRate CI should also be valid
    const passRateCI = highQuality?.confidenceIntervals?.passRate
    expect(passRateCI).toHaveLength(2)
    expect(passRateCI?.[0]).toBeLessThanOrEqual(passRateCI?.[1] ?? 0)

    // Verify reliability metrics include type discriminator
    expect(report.reliability.high?.type).toBe('run')
    expect(report.reliability.low?.type).toBe('run')

    // Verify quality metrics include type discriminator
    expect(report.quality.high?.type).toBe('run')
    expect(report.quality.low?.type).toBe('run')
  })

  test('computes confidence intervals for performance metrics', async () => {
    const run1Path = `${tempDir}/ci-perf-run1.jsonl`
    const run2Path = `${tempDir}/ci-perf-run2.jsonl`

    // Create results with varying latencies
    const results1 = [
      createCaptureResult('p1', 0.9, true, 1000),
      createCaptureResult('p2', 0.85, true, 1100),
      createCaptureResult('p3', 0.95, true, 900),
      createCaptureResult('p4', 0.8, true, 1050),
    ]
    const results2 = [
      createCaptureResult('p1', 0.7, true, 2000),
      createCaptureResult('p2', 0.65, true, 2200),
      createCaptureResult('p3', 0.75, true, 1800),
      createCaptureResult('p4', 0.6, true, 2100),
    ]

    await Bun.write(run1Path, results1.map((r) => JSON.stringify(r)).join('\n'))
    await Bun.write(run2Path, results2.map((r) => JSON.stringify(r)).join('\n'))

    const report = await runCompare({
      runs: [
        { label: 'fast', path: run1Path },
        { label: 'slow', path: run2Path },
      ],
      strategy: 'statistical',
      progress: false,
    })

    // Verify confidence intervals are computed for performance
    const fastPerf = report.performance.fast
    expect(fastPerf).toBeDefined()
    expect(fastPerf?.confidenceIntervals).toBeDefined()
    expect(fastPerf?.confidenceIntervals?.latencyMean).toBeDefined()

    // latencyMean CI should be a tuple [lower, upper]
    const latencyCI = fastPerf?.confidenceIntervals?.latencyMean
    expect(latencyCI).toHaveLength(2)
    expect(latencyCI?.[0]).toBeLessThanOrEqual(latencyCI?.[1] ?? 0)

    // Fast run should have lower latency CI than slow run
    const slowPerf = report.performance.slow
    const slowLatencyCI = slowPerf?.confidenceIntervals?.latencyMean
    expect(latencyCI?.[1]).toBeLessThan(slowLatencyCI?.[0] ?? 0)
  })

  test('weighted strategy does not compute confidence intervals', async () => {
    const run1Path = `${tempDir}/no-ci-run1.jsonl`
    const run2Path = `${tempDir}/no-ci-run2.jsonl`

    const results1 = [createCaptureResult('p1', 0.9, true), createCaptureResult('p2', 0.85, true)]
    const results2 = [createCaptureResult('p1', 0.6, false), createCaptureResult('p2', 0.5, false)]

    await Bun.write(run1Path, results1.map((r) => JSON.stringify(r)).join('\n'))
    await Bun.write(run2Path, results2.map((r) => JSON.stringify(r)).join('\n'))

    const report = await runCompare({
      runs: [
        { label: 'run1', path: run1Path },
        { label: 'run2', path: run2Path },
      ],
      strategy: 'weighted', // Default strategy
      progress: false,
    })

    // Confidence intervals should NOT be present for weighted strategy
    const quality = report.quality.run1
    expect(quality?.confidenceIntervals).toBeUndefined()

    const perf = report.performance.run1
    expect(perf?.confidenceIntervals).toBeUndefined()
  })

  test('statistical strategy includes CIs in markdown output', async () => {
    const run1Path = `${tempDir}/ci-md-run1.jsonl`
    const run2Path = `${tempDir}/ci-md-run2.jsonl`
    const outputPath = `${tempDir}/ci-report.md`

    const results1 = [createCaptureResult('p1', 0.9, true, 1000), createCaptureResult('p2', 0.85, true, 1100)]
    const results2 = [createCaptureResult('p1', 0.6, false, 2000), createCaptureResult('p2', 0.5, false, 2100)]

    await Bun.write(run1Path, results1.map((r) => JSON.stringify(r)).join('\n'))
    await Bun.write(run2Path, results2.map((r) => JSON.stringify(r)).join('\n'))

    await runCompare({
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

  test('handles single sample gracefully with degenerate CI', async () => {
    const run1Path = `${tempDir}/single-run1.jsonl`
    const run2Path = `${tempDir}/single-run2.jsonl`

    // Single sample per run
    const result1 = createCaptureResult('p1', 0.9, true)
    const result2 = createCaptureResult('p1', 0.5, false)

    await Bun.write(run1Path, JSON.stringify(result1))
    await Bun.write(run2Path, JSON.stringify(result2))

    const report = await runCompare({
      runs: [
        { label: 'single1', path: run1Path },
        { label: 'single2', path: run2Path },
      ],
      strategy: 'statistical',
      progress: false,
    })

    // Should still compute CIs (they will be degenerate for single sample)
    const quality = report.quality.single1
    expect(quality?.confidenceIntervals).toBeDefined()
    expect(quality?.confidenceIntervals?.avgScore).toBeDefined()

    // For single sample, CI should collapse to the value
    const ci = quality?.confidenceIntervals?.avgScore
    expect(ci?.[0]).toBeCloseTo(ci?.[1] ?? 0, 2)
    expect(ci?.[0]).toBeCloseTo(quality?.avgScore ?? 0, 2)
  })

  test('JSON output includes confidence intervals structure', async () => {
    const run1Path = `${tempDir}/json-ci-run1.jsonl`
    const run2Path = `${tempDir}/json-ci-run2.jsonl`
    const outputPath = `${tempDir}/ci-report.json`

    const results1 = [
      createCaptureResult('p1', 0.9, true),
      createCaptureResult('p2', 0.85, true),
      createCaptureResult('p3', 0.95, true),
    ]
    const results2 = [
      createCaptureResult('p1', 0.6, false),
      createCaptureResult('p2', 0.5, false),
      createCaptureResult('p3', 0.7, true),
    ]

    await Bun.write(run1Path, results1.map((r) => JSON.stringify(r)).join('\n'))
    await Bun.write(run2Path, results2.map((r) => JSON.stringify(r)).join('\n'))

    await runCompare({
      runs: [
        { label: 'high', path: run1Path },
        { label: 'low', path: run2Path },
      ],
      strategy: 'statistical',
      outputPath,
      format: 'json',
      progress: false,
    })

    const content = await Bun.file(outputPath).text()
    const parsed = JSON.parse(content)

    // Verify JSON structure includes confidenceIntervals
    expect(parsed.quality.high.confidenceIntervals).toBeDefined()
    expect(parsed.quality.high.confidenceIntervals.avgScore).toBeInstanceOf(Array)
    expect(parsed.quality.high.confidenceIntervals.avgScore.length).toBe(2)
    expect(parsed.performance.high.confidenceIntervals).toBeDefined()
    expect(parsed.performance.high.confidenceIntervals.latencyMean).toBeInstanceOf(Array)
  })
})
