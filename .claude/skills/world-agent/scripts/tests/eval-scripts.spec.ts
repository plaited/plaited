import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { $ } from 'bun'

const scriptsDir = join(import.meta.dir, '..')
const tmpDir = '/tmp/claude/eval-scripts-test'

// Test fixtures
const createTestConfig = () => ({
  baselineModel: 'claude-sonnet-4',
  templateType: 'UI Templates',
  skills: ['plaited-ui-patterns'],
  metrics: {
    functional: ['storyPass'],
    quality: ['patternCompliance'],
    trajectory: ['toolEfficiency'],
  },
  thresholds: {
    minStoryPassRate: 0.9,
    maxIterations: 3,
    minA11yScore: 1.0,
  },
})

const createTestResults = () => ({
  evalDir: tmpDir,
  timestamp: new Date().toISOString(),
  config: createTestConfig(),
  summary: {
    totalTests: 2,
    baselineWins: 1,
    agentWins: 1,
    ties: 0,
  },
  results: [
    {
      testCase: { exportName: 'PrimaryButton', intent: 'Create primary button', file: 'button.stories.tsx' },
      baseline: { passed: true, a11yPassed: true, iterations: 1, duration: 100, toolCalls: 3 },
      agent: { passed: true, a11yPassed: true, iterations: 1, duration: 80, toolCalls: 2, constraintViolations: 0 },
      comparison: { baselineWins: false, agentWins: true, tie: false, reason: 'Agent more efficient' },
    },
    {
      testCase: { exportName: 'SecondaryButton', intent: 'Create secondary button', file: 'button.stories.tsx' },
      baseline: { passed: true, a11yPassed: true, iterations: 1, duration: 90, toolCalls: 2 },
      agent: { passed: false, a11yPassed: true, iterations: 2, duration: 150, toolCalls: 4, constraintViolations: 1 },
      comparison: { baselineWins: true, agentWins: false, tie: false, reason: 'Agent failed story' },
    },
  ],
})

beforeAll(async () => {
  // Create temp directory and fixtures
  const { mkdir } = await import('node:fs/promises')
  await mkdir(join(tmpDir, 'templates'), { recursive: true })
  await Bun.write(join(tmpDir, 'config.json'), JSON.stringify(createTestConfig(), null, 2))
  await Bun.write(join(tmpDir, 'results.json'), JSON.stringify(createTestResults(), null, 2))
  await Bun.write(join(tmpDir, 'templates/.gitkeep'), '')
})

afterAll(async () => {
  // Cleanup
  const { rm } = await import('node:fs/promises')
  await rm(tmpDir, { recursive: true, force: true })
})

// ============================================================================
// run-eval-suite.ts Tests
// ============================================================================

describe('run-eval-suite', () => {
  test('shows help with --help flag', async () => {
    const result = await $`bun ${scriptsDir}/run-eval-suite.ts --help`.text()

    expect(result).toContain('Run the full evaluation suite')
    expect(result).toContain('--baseline-only')
    expect(result).toContain('--agent-only')
  })

  test('exits with error when no eval-dir provided', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/run-eval-suite.ts`], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited

    expect(exitCode).toBe(1)
  })

  test('loads config from eval directory', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/run-eval-suite.ts`, tmpDir, '--verbose'], {
      stderr: 'pipe',
    })

    const stderr = await new Response(proc.stderr).text()
    await proc.exited

    expect(stderr).toContain('Loaded config')
    expect(stderr).toContain('claude-sonnet-4')
  })
})

// ============================================================================
// compare-baseline.ts Tests
// ============================================================================

describe('compare-baseline', () => {
  test('shows help with --help flag', async () => {
    const result = await $`bun ${scriptsDir}/compare-baseline.ts --help`.text()

    expect(result).toContain('Compare Claude Code one-shot generation')
    expect(result).toContain('--test')
    expect(result).toContain('--format')
  })

  test('exits with error when no eval-dir provided', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/compare-baseline.ts`], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited

    expect(exitCode).toBe(1)
  })

  test('outputs JSON by default', async () => {
    const result = await $`bun ${scriptsDir}/compare-baseline.ts ${tmpDir}`.text()
    const parsed = JSON.parse(result)

    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBe(2)
    expect(parsed[0]).toHaveProperty('testCase')
    expect(parsed[0]).toHaveProperty('metrics')
    expect(parsed[0]).toHaveProperty('overallWinner')
  })

  test('filters by specific test case', async () => {
    const result = await $`bun ${scriptsDir}/compare-baseline.ts ${tmpDir} --test PrimaryButton`.text()
    const parsed = JSON.parse(result)

    expect(parsed.length).toBe(1)
    expect(parsed[0].testCase).toBe('PrimaryButton')
  })

  test('outputs markdown format', async () => {
    const result = await $`bun ${scriptsDir}/compare-baseline.ts ${tmpDir} --format markdown`.text()

    expect(result).toContain('# World Agent vs Baseline Comparison')
    expect(result).toContain('## PrimaryButton')
    expect(result).toContain('| Metric |')
  })
})

// ============================================================================
// generate-report.ts Tests
// ============================================================================

describe('generate-report', () => {
  test('shows help with --help flag', async () => {
    const result = await $`bun ${scriptsDir}/generate-report.ts --help`.text()

    expect(result).toContain('Generate human-readable evaluation report')
    expect(result).toContain('--format')
    expect(result).toContain('markdown | html')
  })

  test('exits with error when no eval-dir provided', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/generate-report.ts`], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited

    expect(exitCode).toBe(1)
  })

  test('generates markdown report', async () => {
    const outputPath = join(tmpDir, 'test-report.md')
    await $`bun ${scriptsDir}/generate-report.ts ${tmpDir} -o ${outputPath}`

    const file = Bun.file(outputPath)
    expect(await file.exists()).toBe(true)

    const content = await file.text()
    expect(content).toContain('# World Agent Evaluation Report')
    expect(content).toContain('## Executive Summary')
    expect(content).toContain('## Recommendations')
    expect(content).toContain('PrimaryButton')
    expect(content).toContain('SecondaryButton')
  })

  test('generates html report', async () => {
    const outputPath = join(tmpDir, 'test-report.html')
    await $`bun ${scriptsDir}/generate-report.ts ${tmpDir} --format html -o ${outputPath}`

    const file = Bun.file(outputPath)
    expect(await file.exists()).toBe(true)

    const content = await file.text()
    expect(content).toContain('<!DOCTYPE html>')
    expect(content).toContain('World Agent Evaluation Report')
  })

  test('includes recommendations in report', async () => {
    const outputPath = join(tmpDir, 'recommendations.md')
    await $`bun ${scriptsDir}/generate-report.ts ${tmpDir} -o ${outputPath}`

    const content = await Bun.file(outputPath).text()

    // Should have recommendations because agent has a failure
    expect(content).toContain('## Recommendations')
    // The test data has constraint violations
    expect(content).toContain('Constraint Violations')
  })
})
