/**
 * Dry-run tests for eval scripts — verify imports, arg parsing, and config.
 *
 * @remarks
 * These tests validate the scripts parse correctly and their
 * dependencies resolve, without actually running frontier agent trials.
 */

import { describe, expect, test } from 'bun:test'
import { join, resolve } from 'node:path'

const PROJECT_ROOT = resolve(import.meta.dir, '..')

describe('run-eval.ts', () => {
  test('imports resolve without errors', async () => {
    const mod = await import('./run-eval.ts')
    expect(mod.parseArgs).toBeDefined()
    expect(mod.filterPrompts).toBeDefined()
    expect(mod.main).toBeDefined()
  })

  test('parseArgs returns valid defaults', async () => {
    const { parseArgs } = await import('./run-eval.ts')
    // parseArgs reads process.argv, so defaults when no args
    const args = parseArgs()
    expect(args.pilot).toBe(false)
    expect(args.k).toBe(3)
    expect(args.concurrency).toBe(1)
    expect(typeof args.workspace).toBe('string')
    expect(typeof args.timeout).toBe('number')
  })

  test('prompts.jsonl exists and has 20 valid entries', async () => {
    const promptsPath = join(PROJECT_ROOT, 'skills/modnet-modules/assets/prompts.jsonl')
    const file = Bun.file(promptsPath)
    expect(await file.exists()).toBe(true)

    const content = await file.text()
    const lines = content.trim().split('\n')
    expect(lines.length).toBe(20)

    for (const line of lines) {
      const prompt = JSON.parse(line)
      expect(prompt.id).toBeDefined()
      expect(typeof prompt.input).toBe('string')
      expect(prompt.metadata).toBeDefined()
      expect(prompt.metadata.eval_ref).toBeDefined()
      expect(prompt.metadata.eval_ref.intention).toBeDefined()
      expect(prompt.metadata.eval_ref.static).toBeDefined()
      expect(prompt.metadata.eval_ref.dynamic).toBeDefined()
    }
  })

  test('physics-simulator has RK4 hint', async () => {
    const promptsPath = join(PROJECT_ROOT, 'skills/modnet-modules/assets/prompts.jsonl')
    const content = await Bun.file(promptsPath).text()
    const prompts = content
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l))
    const physics = prompts.find((p: { id: string }) => p.id === 'physics-simulator')
    expect(physics).toBeDefined()
    expect(physics.hint).toContain('RK4')
    expect(physics.hint).toContain('plaited h()')
  })
})

describe('analyze-eval.ts', () => {
  test('imports resolve without errors', async () => {
    const mod = await import('./analyze-eval.ts')
    expect(mod.main).toBeDefined()
  })
})
