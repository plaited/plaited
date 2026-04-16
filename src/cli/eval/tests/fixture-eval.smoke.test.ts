/**
 * Smoke tests for fixture eval and compare-trials flow.
 *
 * @remarks
 * These tests create minimal test fixtures (adapter, prompts, grader) and verify
 * that the plaited eval and compare-trials commands work end-to-end.
 * Uses ./bin/plaited.ts directly for repo-local testing.
 */

import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'

const CLI_PACKAGE_ROOT = resolve(import.meta.dir, '../../../../')

/** Test fixtures directory */
let fixturesDir: string
/** Temp files to clean up */
const tempFiles: string[] = []

const fixturePath = (name: string): string => {
  const path = resolve(fixturesDir, name)
  tempFiles.push(path)
  return path
}

beforeEach(async () => {
  fixturesDir = resolve(tmpdir(), `plaited-smoke-${Date.now()}`)
  await mkdir(fixturesDir, { recursive: true })
  tempFiles.length = 0
})

afterEach(async () => {
  for (const f of tempFiles) {
    await rm(f, { force: true }).catch(() => {})
  }
  await rm(fixturesDir, { force: true }).catch(() => {})
})

describe('plaited eval fixture smoke tests', () => {
  test('plaited eval with minimal adapter and prompts', async () => {
    const adapterPath = fixturePath('echo-adapter.ts')
    await writeFile(
      adapterPath,
      `export const adapt = async ({ prompt }) => ({
        output: Array.isArray(prompt) ? prompt.join(' ') : prompt,
      })`,
    )

    const promptsPath = fixturePath('prompts.jsonl')
    await writeFile(promptsPath, '{"id":"t1","input":"hello"}\n{"id":"t2","input":"world"}\n')

    const result = await Bun.$`
      bun ./bin/plaited.ts eval '{"adapterPath":"${adapterPath}","promptsPath":"${promptsPath}","k":1}'
    `
      .cwd(CLI_PACKAGE_ROOT)
      .nothrow()

    expect(result.exitCode).toBe(0)
    const lines = result.stdout.toString().trim().split('\n').filter(Boolean)
    expect(lines.length).toBeGreaterThanOrEqual(1)
    const line0 = lines[0]!
    const firstResult = JSON.parse(line0)
    expect(firstResult.id).toBe('t1')
    expect(firstResult.k).toBe(1)
    expect(firstResult.trials).toBeDefined()
    expect(firstResult.trials.length).toBe(1)
    expect(firstResult.trials[0].output).toBe('hello')
  })

  test('plaited eval with grader produces pass/fail metrics', async () => {
    const adapterPath = fixturePath('echo-adapter.ts')
    await writeFile(adapterPath, `export const adapt = async ({ prompt }) => ({ output: prompt as string })`)

    const graderPath = fixturePath('pass-all-grader.ts')
    await writeFile(
      graderPath,
      `export const grade = async ({ output }) => ({
        pass: output.length > 0,
        score: 1.0,
        reasoning: 'Output is non-empty',
      })`,
    )

    const promptsPath = fixturePath('prompts.jsonl')
    await writeFile(promptsPath, '{"id":"g1","input":"test"}\n')

    const result = await Bun.$`
      bun ./bin/plaited.ts eval '{"adapterPath":"${adapterPath}","promptsPath":"${promptsPath}","graderPath":"${graderPath}","k":1}'
    `
      .cwd(CLI_PACKAGE_ROOT)
      .nothrow()

    expect(result.exitCode).toBe(0)
    const lines = result.stdout.toString().trim().split('\n').filter(Boolean)
    const line0 = lines[0]!
    const evalResult = JSON.parse(line0)
    expect(evalResult.id).toBe('g1')
    expect(evalResult.passRate).toBe(1)
    expect(evalResult.trials[0].pass).toBe(true)
  })

  test('plaited eval with output file writes JSONL', async () => {
    const adapterPath = fixturePath('echo-adapter.ts')
    await writeFile(adapterPath, `export const adapt = async ({ prompt }) => ({ output: 'resp: ' + prompt })`)

    const promptsPath = fixturePath('prompts.jsonl')
    await writeFile(promptsPath, '{"id":"o1","input":"test"}\n')

    const outputPath = fixturePath('output.jsonl')

    const result = await Bun.$`
      bun ./bin/plaited.ts eval '{"adapterPath":"${adapterPath}","promptsPath":"${promptsPath}","outputPath":"${outputPath}","k":1}'
    `
      .cwd(CLI_PACKAGE_ROOT)
      .nothrow()

    expect(result.exitCode).toBe(0)
    const outputContent = await Bun.file(outputPath).text()
    const firstLine = outputContent.trim().split('\n')[0]
    if (!firstLine) throw new Error('No output in file')
    const evalResult = JSON.parse(firstLine)
    expect(evalResult.id).toBe('o1')
    expect(evalResult.trials[0].output).toBe('resp: test')
  })
})
