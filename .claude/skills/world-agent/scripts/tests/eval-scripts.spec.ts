import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { $ } from 'bun'

const scriptsDir = join(import.meta.dir, '..')
const tmpDir = '/tmp/claude/eval-scripts-test'
const trajectoriesDir = '/tmp/claude/trajectories-test'

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

// Trajectory test fixtures
const createTestTrajectories = () => [
  {
    intent: 'Create a primary button',
    toolCalls: [{ name: 'writeTemplate', arguments: '{"path":"button.tsx"}' }],
    reward: 0.9,
    storyResult: { passed: true, a11yPassed: true, totalAssertions: 3, passedAssertions: 3, errors: [] },
  },
  {
    intent: 'Create a secondary button',
    toolCalls: [{ name: 'writeTemplate', arguments: '{"path":"button2.tsx"}' }],
    reward: 0.5,
    storyResult: { passed: false, a11yPassed: true, totalAssertions: 3, passedAssertions: 2, errors: ['Failed'] },
  },
  {
    intent: 'Create a disabled button',
    toolCalls: [{ name: 'writeTemplate', arguments: '{"path":"button3.tsx"}' }],
    reward: 1.0,
    storyResult: { passed: true, a11yPassed: true, totalAssertions: 5, passedAssertions: 5, errors: [] },
  },
]

// Story file fixture for generate-trajectories
const createTestStoryFile = () => `import { story } from 'plaited/testing'

export const meta = { title: 'Button' }

const ButtonTemplate = ({ children }) => <button>{children}</button>

export const Primary = story({
  template: () => <ButtonTemplate>Click</ButtonTemplate>,
  intent: 'Create a primary button with hover state',
  play: async ({ assert }) => { await assert.a11y() },
})

export const Secondary = story({
  template: () => <ButtonTemplate>Secondary</ButtonTemplate>,
  intent: 'Create a secondary outline button',
  play: async ({ assert }) => { await assert.a11y() },
})
`

beforeAll(async () => {
  // Create temp directories and fixtures
  await mkdir(join(tmpDir, 'templates'), { recursive: true })
  await mkdir(trajectoriesDir, { recursive: true })

  // Eval fixtures
  await Bun.write(join(tmpDir, 'config.json'), JSON.stringify(createTestConfig(), null, 2))
  await Bun.write(join(tmpDir, 'results.json'), JSON.stringify(createTestResults(), null, 2))
  await Bun.write(join(tmpDir, 'templates/.gitkeep'), '')

  // Trajectory fixtures
  const trajectories = createTestTrajectories()
  await Bun.write(join(trajectoriesDir, 'trajectories.jsonl'), trajectories.map((t) => JSON.stringify(t)).join('\n'))
  await Bun.write(join(trajectoriesDir, 'button.stories.tsx'), createTestStoryFile())
})

afterAll(async () => {
  // Cleanup
  await rm(tmpDir, { recursive: true, force: true })
  await rm(trajectoriesDir, { recursive: true, force: true })
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

// ============================================================================
// scaffold-training-story.ts Tests
// ============================================================================

describe('scaffold-training-story', () => {
  test('shows help with --help flag', async () => {
    const result = await $`bun ${scriptsDir}/scaffold-training-story.ts --help`.text()

    expect(result).toContain('Scaffold a training story file')
    expect(result).toContain('--category')
    expect(result).toContain('--intents')
    expect(result).toContain('--output')
  })

  test('exits with error when no name provided', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/scaffold-training-story.ts`], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited

    expect(exitCode).toBe(1)
  })

  test('generates story file with default intent', async () => {
    const outputPath = join(trajectoriesDir, 'test-default.stories.tsx')
    const result = await $`bun ${scriptsDir}/scaffold-training-story.ts test-default -o ${trajectoriesDir}`.json()

    expect(result.created).toEndWith('test-default.stories.tsx')
    expect(result.category).toBe('Test-default')
    expect(result.intents).toBe(1)

    const file = Bun.file(outputPath)
    expect(await file.exists()).toBe(true)

    const content = await file.text()
    expect(content).toContain("import { story } from 'plaited/testing'")
    expect(content).toContain('export const Default = story')
    expect(content).toContain('intent:')
  })

  test('generates story file with custom category and intents', async () => {
    const outputPath = join(trajectoriesDir, 'card.stories.tsx')
    const result =
      await $`bun ${scriptsDir}/scaffold-training-story.ts card -c Card -i "simple,with header,with footer" -o ${trajectoriesDir}`.json()

    expect(result.category).toBe('Card')
    expect(result.intents).toBe(3)
    expect(result.stories).toContain('Simple')
    expect(result.stories).toContain('WithHeader')
    expect(result.stories).toContain('WithFooter')

    const content = await Bun.file(outputPath).text()
    expect(content).toContain("title: 'Card'")
    expect(content).toContain('export const Simple = story')
    expect(content).toContain('export const WithHeader = story')
    expect(content).toContain('export const WithFooter = story')
  })

  test('converts intents to proper export names', async () => {
    const result =
      await $`bun ${scriptsDir}/scaffold-training-story.ts input -c Input -i "with error message,disabled state" -o ${trajectoriesDir}`.json()

    expect(result.stories).toContain('WithErrorMessage')
    expect(result.stories).toContain('DisabledState')
  })
})

// ============================================================================
// compute-rewards.ts Tests
// ============================================================================

describe('compute-rewards', () => {
  test('shows help with --help flag', async () => {
    const result = await $`bun ${scriptsDir}/compute-rewards.ts --help`.text()

    expect(result).toContain('Compute and filter rewards')
    expect(result).toContain('--min-reward')
    expect(result).toContain('--stats')
    expect(result).toContain('--output')
  })

  test('exits with error when no input file provided', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/compute-rewards.ts`], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited

    expect(exitCode).toBe(1)
  })

  test('computes stats from trajectory file', async () => {
    const inputPath = join(trajectoriesDir, 'trajectories.jsonl')
    const proc = Bun.spawn(['bun', `${scriptsDir}/compute-rewards.ts`, inputPath, '--stats'], {
      stderr: 'pipe',
    })

    const stderr = await new Response(proc.stderr).text()
    await proc.exited

    expect(stderr).toContain('Loaded 3 trajectories')
    expect(stderr).toContain('Mean reward:')
    expect(stderr).toContain('Pass rate:')
    expect(stderr).toContain('A11y pass rate:')
  })

  test('filters trajectories by minimum reward', async () => {
    const inputPath = join(trajectoriesDir, 'trajectories.jsonl')
    const outputPath = join(trajectoriesDir, 'filtered.jsonl')

    await $`bun ${scriptsDir}/compute-rewards.ts ${inputPath} --min-reward 0.8 -o ${outputPath}`

    const file = Bun.file(outputPath)
    expect(await file.exists()).toBe(true)

    const content = await file.text()
    const lines = content.trim().split('\n')

    // Only trajectories with reward >= 0.8 should be included (0.9 and 1.0)
    expect(lines.length).toBe(2)
  })

  test('outputs all trajectories when no filter applied', async () => {
    const inputPath = join(trajectoriesDir, 'trajectories.jsonl')
    const result = await $`bun ${scriptsDir}/compute-rewards.ts ${inputPath}`.text()

    const lines = result.trim().split('\n')
    expect(lines.length).toBe(3)
  })
})

// ============================================================================
// generate-trajectories.ts Tests
// ============================================================================

describe('generate-trajectories', () => {
  test('shows help with --help flag', async () => {
    const result = await $`bun ${scriptsDir}/generate-trajectories.ts --help`.text()

    expect(result).toContain('Generate training trajectories')
    expect(result).toContain('--output')
    expect(result).toContain('--format')
    expect(result).toContain('jsonl')
  })

  test('exits with error when no paths provided', async () => {
    const proc = Bun.spawn(['bun', `${scriptsDir}/generate-trajectories.ts`], {
      stderr: 'pipe',
    })
    const exitCode = await proc.exited

    expect(exitCode).toBe(1)
  })

  test('generates trajectories from story files', async () => {
    const outputPath = join(trajectoriesDir, 'generated.jsonl')
    const proc = Bun.spawn(['bun', `${scriptsDir}/generate-trajectories.ts`, trajectoriesDir, '-o', outputPath], {
      stderr: 'pipe',
    })

    const stderr = await new Response(proc.stderr).text()
    await proc.exited

    expect(stderr).toContain('Generating trajectories from')
    expect(stderr).toContain('Found')
    expect(stderr).toContain('stories with intents')

    const file = Bun.file(outputPath)
    expect(await file.exists()).toBe(true)
  })

  test('outputs JSON format when specified', async () => {
    const outputPath = join(trajectoriesDir, 'generated.json')

    await $`bun ${scriptsDir}/generate-trajectories.ts ${trajectoriesDir} -f json -o ${outputPath}`

    const content = await Bun.file(outputPath).text()

    // Should be valid JSON array
    const parsed = JSON.parse(content)
    expect(Array.isArray(parsed)).toBe(true)
  })

  test('extracts intents from story exports', async () => {
    const result = await $`bun ${scriptsDir}/generate-trajectories.ts ${trajectoriesDir} -f json`.text()
    const trajectories = JSON.parse(result)

    // Should find the two stories from button.stories.tsx with intent fields
    const intents = trajectories.map((t: { intent: string }) => t.intent)
    expect(intents).toContain('Create a primary button with hover state')
    expect(intents).toContain('Create a secondary outline button')
  })
})
