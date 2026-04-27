import { describe, expect, test } from 'bun:test'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const CLI_PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../')

const fixtureInput = JSON.stringify({
  baseline: {
    label: 'baseline',
    results: [
      {
        id: 'p1',
        input: 'alpha',
        trials: [{ trialNum: 1, output: 'ok', duration: 20, pass: true, score: 1 }],
      },
      {
        id: 'p2',
        input: 'beta',
        trials: [{ trialNum: 1, output: 'no', duration: 30, pass: false, score: 0 }],
      },
    ],
  },
  challenger: {
    label: 'challenger',
    results: [
      {
        id: 'p1',
        input: 'alpha',
        trials: [{ trialNum: 1, output: 'ok', duration: 18, pass: true, score: 1 }],
      },
      {
        id: 'p2',
        input: 'beta',
        trials: [{ trialNum: 1, output: 'yes', duration: 19, pass: true, score: 1 }],
      },
    ],
  },
  resamples: 100,
  confidence: 0.8,
})

const invalidConfidenceInput = JSON.stringify({
  ...JSON.parse(fixtureInput),
  confidence: 1,
})

describe('research CLI smoke tests', () => {
  test('plaited --schema includes research', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts --schema`.cwd(CLI_PACKAGE_ROOT).nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString())
    expect(output.commands).toContain('research')
  })

  test('plaited research --schema input emits schema', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts research --schema input`.cwd(CLI_PACKAGE_ROOT).nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString())
    expect(typeof output.$schema).toBe('string')
    expect(output.$schema).toContain('json-schema.org')
    expect(output.description).toContain('post-run research comparison')
    expect(output.properties.baseline).toBeDefined()
    expect(output.properties.challenger).toBeDefined()
  })

  test('plaited research compares runs and returns a promotion decision', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts research ${fixtureInput}`.cwd(CLI_PACKAGE_ROOT).nothrow()
    expect(result.exitCode).toBe(0)

    const output = JSON.parse(result.stdout.toString())
    expect(output.comparison.summary.totalPrompts).toBe(2)
    expect(output.comparison.summary.challengerWins).toBe(1)
    expect(output.decision.decision).toBe('promote_challenger')
    expect(output.decision.winner).toBe('challenger')
  })

  test('plaited research rejects invalid confidence values', async () => {
    const result = await Bun.$`bun ./bin/plaited.ts research ${invalidConfidenceInput}`.cwd(CLI_PACKAGE_ROOT).nothrow()
    expect(result.exitCode).not.toBe(0)

    const outputText = `${result.stdout.toString()}${result.stderr.toString()}`
    expect(outputText).toContain('confidence')
  })
})
