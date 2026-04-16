/**
 * Smoke tests for compare-trials fixture flow.
 *
 * @remarks
 * Verifies end-to-end compare-trials functionality with minimal test fixtures.
 * Uses ./bin/plaited.ts directly for repo-local testing.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../../')

let fixturesDir: string
const tempFiles: string[] = []

const fixturePath = (name: string): string => {
  const path = resolve(fixturesDir, name)
  tempFiles.push(path)
  return path
}

beforeEach(async () => {
  fixturesDir = resolve(tmpdir(), `plaited-smoke-ct-${Date.now()}`)
  await mkdir(fixturesDir, { recursive: true })
  tempFiles.length = 0
})

afterEach(async () => {
  for (const f of tempFiles) {
    await rm(f, { force: true }).catch(() => {})
  }
  await rm(fixturesDir, { force: true }).catch(() => {})
})

describe('plaited compare-trials fixture smoke tests', () => {
  test('compare-trials with two result files', async () => {
    const baselinePath = fixturePath('baseline.jsonl')
    await writeFile(
      baselinePath,
      JSON.stringify({
        id: 'c1',
        input: 'a',
        k: 1,
        passRate: 0.5,
        passAtK: 0.5,
        passExpK: 0.25,
        trials: [{ trialNum: 1, output: 'x', duration: 10, pass: true }],
      }) +
        '\n' +
        JSON.stringify({
          id: 'c2',
          input: 'b',
          k: 1,
          passRate: 0,
          passAtK: 0,
          passExpK: 0,
          trials: [{ trialNum: 1, output: 'y', duration: 20, pass: false }],
        }) +
        '\n',
    )

    const challengerPath = fixturePath('challenger.jsonl')
    await writeFile(
      challengerPath,
      JSON.stringify({
        id: 'c1',
        input: 'a',
        k: 1,
        passRate: 1,
        passAtK: 1,
        passExpK: 1,
        trials: [{ trialNum: 1, output: 'x', duration: 12, pass: true }],
      }) +
        '\n' +
        JSON.stringify({
          id: 'c2',
          input: 'b',
          k: 1,
          passRate: 1,
          passAtK: 1,
          passExpK: 1,
          trials: [{ trialNum: 1, output: 'y', duration: 18, pass: true }],
        }) +
        '\n',
    )

    const result = await Bun.$`
      bun ./bin/plaited.ts compare-trials '{"baselinePath":"${baselinePath}","challengerPath":"${challengerPath}","resamples":100,"confidence":0.8}'
    `
      .cwd(CLI_PACKAGE_ROOT)
      .nothrow()

    expect(result.exitCode).toBe(0)
    const comparison = JSON.parse(result.stdout.toString().trim())
    expect(comparison.baseline).toBeDefined()
    expect(comparison.challenger).toBeDefined()
    expect(comparison.summary).toBeDefined()
    expect(comparison.summary.totalPrompts).toBe(2)
    expect(comparison.baseline.avgPassRate).toBe(0.25) // (0.5 + 0) / 2 = 0.25
    expect(comparison.challenger.avgPassRate).toBe(1)
  })

  test('compare-trials produces winner per prompt', async () => {
    const baselinePath = fixturePath('baseline2.jsonl')
    await writeFile(
      baselinePath,
      JSON.stringify({
        id: 'p1',
        input: 'q1',
        k: 1,
        passRate: 1,
        passAtK: 1,
        passExpK: 1,
        trials: [{ trialNum: 1, output: 'x', duration: 10, pass: true }],
      }) +
        '\n' +
        JSON.stringify({
          id: 'p2',
          input: 'q2',
          k: 1,
          passRate: 0,
          passAtK: 0,
          passExpK: 0,
          trials: [{ trialNum: 1, output: 'y', duration: 10, pass: false }],
        }) +
        '\n',
    )

    const challengerPath = fixturePath('challenger2.jsonl')
    await writeFile(
      challengerPath,
      JSON.stringify({
        id: 'p1',
        input: 'q1',
        k: 1,
        passRate: 0,
        passAtK: 0,
        passExpK: 0,
        trials: [{ trialNum: 1, output: 'x', duration: 10, pass: false }],
      }) +
        '\n' +
        JSON.stringify({
          id: 'p2',
          input: 'q2',
          k: 1,
          passRate: 1,
          passAtK: 1,
          passExpK: 1,
          trials: [{ trialNum: 1, output: 'y', duration: 10, pass: true }],
        }) +
        '\n',
    )

    const result = await Bun.$`
      bun ./bin/plaited.ts compare-trials '{"baselinePath":"${baselinePath}","challengerPath":"${challengerPath}"}'
    `
      .cwd(CLI_PACKAGE_ROOT)
      .nothrow()

    expect(result.exitCode).toBe(0)
    const comparison = JSON.parse(result.stdout.toString().trim())
    expect(comparison.summary.baselineWins).toBe(1)
    expect(comparison.summary.challengerWins).toBe(1)
    expect(comparison.summary.ties).toBe(0)

    const p1Result = comparison.perPrompt.find((p: { id: string }) => p.id === 'p1')
    const p2Result = comparison.perPrompt.find((p: { id: string }) => p.id === 'p2')
    expect(p1Result?.winner).toBe('baseline')
    expect(p2Result?.winner).toBe('challenger')
  })
})
