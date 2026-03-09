/**
 * Tests for the trial runner.
 *
 * @remarks
 * Covers: runTrial (k=1, k=3), pass@k math, grading, concurrency,
 * CLI contract (--help, --schema), loadPolyglot, and utility functions.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { stat, unlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import * as z from 'zod'
import type { Adapter, Grader, PromptCase } from '../trial.schemas.ts'
import { TrialResultSchema } from '../trial.schemas.ts'
import { calculatePassAtK, calculatePassExpK, runTrial, TrialInputSchema, TrialOutputSchema } from '../trial.ts'
import {
  createWorkspaceDir,
  createWriteMutex,
  detectRichness,
  hasToolErrors,
  loadJsonl,
  loadPrompts,
  resolvePath,
  runWorkerPool,
} from '../trial.utils.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

/** Echo adapter — returns input as output */
const echoAdapter: Adapter = async ({ prompt }) => ({
  output: Array.isArray(prompt) ? prompt.join('\n') : prompt,
})

/** Slow echo adapter — adds delay per trial for concurrency testing */
const slowEchoAdapter: Adapter = async ({ prompt }) => {
  await new Promise((resolve) => setTimeout(resolve, 50))
  return { output: Array.isArray(prompt) ? prompt.join('\n') : prompt }
}

/** Adapter that includes trajectory */
const richAdapter: Adapter = async ({ prompt }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  return {
    output: text,
    trajectory: [
      { type: 'thought' as const, content: 'thinking...', timestamp: Date.now() },
      { type: 'message' as const, content: text, timestamp: Date.now() },
    ],
    timing: { total: 100, inputTokens: 10, outputTokens: 20 },
  }
}

/** Adapter that always fails */
const failingAdapter: Adapter = async () => {
  throw new Error('Adapter exploded')
}

/** Always-pass grader */
const passGrader: Grader = async ({ output }) => ({
  pass: true,
  score: 1.0,
  reasoning: `Output: ${output.slice(0, 20)}`,
})

/** Flaky grader — passes 50% of the time */
let flakyCounter = 0
const flakyGrader: Grader = async () => {
  const pass = flakyCounter++ % 2 === 0
  return { pass, score: pass ? 1.0 : 0.0 }
}

const samplePrompts: PromptCase[] = [
  { id: 'p1', input: 'Hello world' },
  { id: 'p2', input: 'Goodbye world' },
]

// ============================================================================
// Temp file tracking
// ============================================================================

const tempFiles: string[] = []
const tempFile = (name: string) => {
  // Timestamp goes before name so file extension stays at the end
  // (isJsModule checks extension for polyglot loader)
  const path = `${tmpdir()}/trial-${Date.now()}-${name}`
  tempFiles.push(path)
  return path
}

afterEach(async () => {
  for (const f of tempFiles) {
    await unlink(f).catch(() => {})
  }
  tempFiles.length = 0
  flakyCounter = 0
})

// ============================================================================
// Pass@k Math
// ============================================================================

describe('calculatePassAtK', () => {
  test('all pass', () => {
    expect(calculatePassAtK(5, 5)).toBe(1)
  })

  test('none pass', () => {
    expect(calculatePassAtK(0, 5)).toBe(0)
  })

  test('partial pass', () => {
    const result = calculatePassAtK(3, 5)
    // 1 - (1 - 0.6)^5 = 1 - 0.4^5 ≈ 0.9898
    expect(result).toBeCloseTo(0.9898, 3)
  })

  test('single trial pass', () => {
    expect(calculatePassAtK(1, 1)).toBe(1)
  })

  test('single trial fail', () => {
    expect(calculatePassAtK(0, 1)).toBe(0)
  })
})

describe('calculatePassExpK', () => {
  test('all pass', () => {
    expect(calculatePassExpK(5, 5)).toBe(1)
  })

  test('none pass', () => {
    expect(calculatePassExpK(0, 5)).toBe(0)
  })

  test('partial pass', () => {
    const result = calculatePassExpK(3, 5)
    // 0.6^5 ≈ 0.0778
    expect(result).toBeCloseTo(0.0778, 3)
  })
})

// ============================================================================
// runTrial — Core Library Function
// ============================================================================

describe('runTrial', () => {
  test('k=1 single trial per prompt', async () => {
    const results = await runTrial({
      adapter: echoAdapter,
      prompts: samplePrompts,
    })

    expect(results).toHaveLength(2)
    const first = results[0]
    expect(first).toBeDefined()
    expect(first!.id).toBe('p1')
    expect(first!.k).toBe(1)
    expect(first!.trials).toHaveLength(1)
    const firstTrial = first!.trials[0]
    expect(firstTrial).toBeDefined()
    expect(firstTrial!.output).toBe('Hello world')
    expect(firstTrial!.trialNum).toBe(1)
    expect(firstTrial!.duration).toBeGreaterThanOrEqual(0)
  })

  test('k=3 multiple trials per prompt', async () => {
    const results = await runTrial({
      adapter: echoAdapter,
      prompts: [{ id: 'multi', input: 'test' }],
      k: 3,
    })

    expect(results).toHaveLength(1)
    const r = results[0]
    expect(r).toBeDefined()
    expect(r!.k).toBe(3)
    expect(r!.trials).toHaveLength(3)
    const t0 = r!.trials[0]
    const t1 = r!.trials[1]
    const t2 = r!.trials[2]
    expect(t0).toBeDefined()
    expect(t1).toBeDefined()
    expect(t2).toBeDefined()
    expect(t0!.trialNum).toBe(1)
    expect(t1!.trialNum).toBe(2)
    expect(t2!.trialNum).toBe(3)
    // All trials should produce the same output for echo adapter
    for (const trial of r!.trials) {
      expect(trial.output).toBe('test')
    }
  })

  test('multi-turn input', async () => {
    const results = await runTrial({
      adapter: echoAdapter,
      prompts: [{ id: 'mt', input: ['Hello', 'World'] }],
    })

    const r = results[0]
    expect(r).toBeDefined()
    const trial = r!.trials[0]
    expect(trial).toBeDefined()
    expect(trial!.output).toBe('Hello\nWorld')
    expect(r!.input).toEqual(['Hello', 'World'])
  })

  test('with grader computes metrics', async () => {
    const results = await runTrial({
      adapter: echoAdapter,
      prompts: [{ id: 'graded', input: 'test', hint: 'should pass' }],
      grader: passGrader,
      k: 3,
    })

    const r = results[0]
    expect(r).toBeDefined()
    expect(r!.passRate).toBe(1)
    expect(r!.passAtK).toBe(1)
    expect(r!.passExpK).toBe(1)
    expect(r!.hint).toBe('should pass')
    for (const trial of r!.trials) {
      expect(trial.pass).toBe(true)
      expect(trial.score).toBe(1.0)
      expect(trial.reasoning).toBeDefined()
    }
  })

  test('flaky grader produces partial metrics', async () => {
    const results = await runTrial({
      adapter: echoAdapter,
      prompts: [{ id: 'flaky', input: 'test' }],
      grader: flakyGrader,
      k: 4,
    })

    const r = results[0]
    expect(r).toBeDefined()
    // flakyCounter: 0 (pass), 1 (fail), 2 (pass), 3 (fail) → 2/4
    expect(r!.passRate).toBe(0.5)
    expect(r!.passAtK).toBeDefined()
    expect(r!.passExpK).toBeDefined()
    expect(r!.passAtK!).toBeGreaterThan(0)
    expect(r!.passAtK!).toBeLessThanOrEqual(1)
    expect(r!.passExpK!).toBeGreaterThanOrEqual(0)
    expect(r!.passExpK!).toBeLessThan(1)
  })

  test('adapter failure records error entry', async () => {
    const results = await runTrial({
      adapter: failingAdapter,
      prompts: [{ id: 'fail', input: 'boom' }],
    })

    expect(results).toHaveLength(1)
    const r = results[0]
    expect(r).toBeDefined()
    const trial = r!.trials[0]
    expect(trial).toBeDefined()
    expect(trial!.output).toBe('')
    expect(trial!.pass).toBe(false)
    expect(trial!.reasoning).toContain('Adapter exploded')
    expect(trial!.duration).toBeGreaterThanOrEqual(0)
  })

  test('adapter timeout records timed out entry', async () => {
    const slowAdapter: Adapter = async () => {
      await new Promise((resolve) => setTimeout(resolve, 5000))
      return { output: 'never' }
    }

    const results = await runTrial({
      adapter: slowAdapter,
      prompts: [{ id: 'timeout', input: 'slow' }],
      timeout: 50,
    })

    const r = results[0]
    expect(r).toBeDefined()
    const trial = r!.trials[0]
    expect(trial).toBeDefined()
    expect(trial!.output).toBe('')
    expect(trial!.timedOut).toBe(true)
    expect(trial!.pass).toBe(false)
  })

  test('rich adapter includes trajectory and timing', async () => {
    const results = await runTrial({
      adapter: richAdapter,
      prompts: [{ id: 'rich', input: 'data' }],
    })

    const r = results[0]
    expect(r).toBeDefined()
    const trial = r!.trials[0]
    expect(trial).toBeDefined()
    expect(trial!.trajectory).toBeDefined()
    expect(trial!.trajectory).toHaveLength(2)
    const traj0 = trial!.trajectory![0]
    const traj1 = trial!.trajectory![1]
    expect(traj0).toBeDefined()
    expect(traj1).toBeDefined()
    expect(traj0!.type).toBe('thought')
    expect(traj1!.type).toBe('message')
    expect(trial!.timing).toBeDefined()
    expect(trial!.timing!.inputTokens).toBe(10)
    expect(trial!.timing!.outputTokens).toBe(20)
  })

  test('writes JSONL to output file', async () => {
    const outPath = tempFile('output.jsonl')

    await runTrial({
      adapter: echoAdapter,
      prompts: samplePrompts,
      outputPath: outPath,
    })

    const content = await Bun.file(outPath).text()
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(2)

    const line0 = lines[0]
    const line1 = lines[1]
    expect(line0).toBeDefined()
    expect(line1).toBeDefined()
    const first = TrialResultSchema.parse(JSON.parse(line0!))
    expect(first.id).toBe('p1')
    const second = TrialResultSchema.parse(JSON.parse(line1!))
    expect(second.id).toBe('p2')
  })

  test('append mode adds to existing file', async () => {
    const outPath = tempFile('append.jsonl')
    await Bun.write(outPath, '{"existing":"line"}\n')

    await runTrial({
      adapter: echoAdapter,
      prompts: [{ id: 'appended', input: 'test' }],
      outputPath: outPath,
      append: true,
    })

    const lines = (await Bun.file(outPath).text()).trim().split('\n')
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe('{"existing":"line"}')
    const appendedLine = lines[1]
    expect(appendedLine).toBeDefined()
    expect(JSON.parse(appendedLine!).id).toBe('appended')
  })

  test('metadata passes through', async () => {
    const results = await runTrial({
      adapter: echoAdapter,
      prompts: [{ id: 'meta', input: 'test', metadata: { category: 'unit', difficulty: 'easy' } }],
    })

    const r = results[0]
    expect(r).toBeDefined()
    expect(r!.metadata).toEqual({ category: 'unit', difficulty: 'easy' })
  })

  test('schema validation on results', () => {
    const result = TrialResultSchema.parse({
      id: 'test',
      input: 'hello',
      k: 1,
      trials: [{ trialNum: 1, output: 'hello', duration: 100 }],
    })
    expect(result.id).toBe('test')
    expect(result.trials).toHaveLength(1)
  })
})

// ============================================================================
// Concurrency
// ============================================================================

describe('concurrency', () => {
  test('concurrent workers process prompts in parallel', async () => {
    const manyPrompts: PromptCase[] = Array.from({ length: 8 }, (_, i) => ({
      id: `c${i}`,
      input: `prompt ${i}`,
    }))

    const start = Date.now()
    const results = await runTrial({
      adapter: slowEchoAdapter,
      prompts: manyPrompts,
      concurrency: 4,
    })
    const elapsed = Date.now() - start

    expect(results).toHaveLength(8)
    // With concurrency=4 and 50ms per prompt, 8 prompts should take ~100ms not ~400ms
    // Allow generous margin for CI
    expect(elapsed).toBeLessThan(400)
  })

  test('concurrent writes do not corrupt JSONL', async () => {
    const outPath = tempFile('concurrent.jsonl')
    const manyPrompts: PromptCase[] = Array.from({ length: 6 }, (_, i) => ({
      id: `w${i}`,
      input: `prompt ${i}`,
    }))

    await runTrial({
      adapter: slowEchoAdapter,
      prompts: manyPrompts,
      concurrency: 3,
      outputPath: outPath,
    })

    const lines = (await Bun.file(outPath).text()).trim().split('\n')
    expect(lines).toHaveLength(6)
    // Every line should be valid JSON
    for (const line of lines) {
      expect(() => JSON.parse(line)).not.toThrow()
    }
  })
})

// ============================================================================
// CLI Contract
// ============================================================================

describe('CLI contract', () => {
  test('--schema input emits JSON Schema', () => {
    const schema = z.toJSONSchema(TrialInputSchema)
    expect(schema.type).toBe('object')
    expect(schema.properties).toBeDefined()
    // Check key fields exist
    const props = schema.properties as Record<string, unknown>
    expect(props.adapterPath).toBeDefined()
    expect(props.promptsPath).toBeDefined()
    expect(props.k).toBeDefined()
    expect(props.graderPath).toBeDefined()
  })

  test('--schema output emits JSON Schema', () => {
    const schema = z.toJSONSchema(TrialOutputSchema)
    expect(schema.type).toBe('array')
  })

  test('TrialInputSchema validates correct input', () => {
    const result = TrialInputSchema.safeParse({
      adapterPath: './adapter.ts',
      promptsPath: './prompts.jsonl',
      k: 5,
    })
    expect(result.success).toBe(true)
  })

  test('TrialInputSchema rejects missing adapterPath', () => {
    const result = TrialInputSchema.safeParse({
      promptsPath: './prompts.jsonl',
    })
    expect(result.success).toBe(false)
  })

  test('TrialInputSchema applies defaults', () => {
    const result = TrialInputSchema.parse({
      adapterPath: './adapter.ts',
    })
    expect(result.k).toBe(1)
    expect(result.concurrency).toBe(1)
    expect(result.progress).toBe(false)
    expect(result.append).toBe(false)
    expect(result.debug).toBe(false)
  })
})

// ============================================================================
// Utility Functions
// ============================================================================

describe('resolvePath', () => {
  test('returns absolute paths unchanged', () => {
    expect(resolvePath('/absolute/path')).toBe('/absolute/path')
  })

  test('resolves relative paths against cwd', () => {
    const resolved = resolvePath('relative/path')
    expect(resolved.startsWith('/')).toBe(true)
    expect(resolved.endsWith('relative/path')).toBe(true)
  })
})

describe('loadJsonl', () => {
  test('loads JSONL file', async () => {
    const path = tempFile('test.jsonl')
    await Bun.write(path, '{"a":1}\n{"a":2}\n{"a":3}\n')

    const data = await loadJsonl<{ a: number }>(path)
    expect(data).toHaveLength(3)
    const d0 = data[0]
    const d2 = data[2]
    expect(d0).toBeDefined()
    expect(d2).toBeDefined()
    expect(d0!.a).toBe(1)
    expect(d2!.a).toBe(3)
  })

  test('skips empty lines', async () => {
    const path = tempFile('sparse.jsonl')
    await Bun.write(path, '{"a":1}\n\n{"a":2}\n')

    const data = await loadJsonl(path)
    expect(data).toHaveLength(2)
  })

  test('throws on invalid JSON', async () => {
    const path = tempFile('invalid.jsonl')
    await Bun.write(path, '{"a":1}\nnot-json\n')

    await expect(loadJsonl(path)).rejects.toThrow('Invalid JSON at line 2')
  })
})

describe('loadPrompts', () => {
  test('validates against PromptCaseSchema', async () => {
    const path = tempFile('prompts.jsonl')
    await Bun.write(path, '{"id":"p1","input":"hello"}\n{"id":"p2","input":["a","b"]}\n')

    const prompts = await loadPrompts(path)
    expect(prompts).toHaveLength(2)
    const p0 = prompts[0]
    const p1 = prompts[1]
    expect(p0).toBeDefined()
    expect(p1).toBeDefined()
    expect(p0!.id).toBe('p1')
    expect(p1!.input).toEqual(['a', 'b'])
  })

  test('rejects invalid prompts', async () => {
    const path = tempFile('bad-prompts.jsonl')
    await Bun.write(path, '{"id":"p1"}\n') // missing input

    await expect(loadPrompts(path)).rejects.toThrow('Invalid prompt at line 1')
  })
})

describe('runWorkerPool', () => {
  test('sequential execution (concurrency=1)', async () => {
    const items = [1, 2, 3]
    const { results, errors } = await runWorkerPool(items, async (n) => n * 2, { concurrency: 1 })
    expect(results).toEqual([2, 4, 6])
    expect(errors).toHaveLength(0)
  })

  test('parallel execution', async () => {
    const items = [1, 2, 3, 4]
    const { results, errors } = await runWorkerPool(
      items,
      async (n) => {
        await new Promise((r) => setTimeout(r, 10))
        return n * 2
      },
      { concurrency: 2 },
    )
    expect(results).toHaveLength(4)
    expect(errors).toHaveLength(0)
    // Results may be in any order
    expect(results.sort()).toEqual([2, 4, 6, 8])
  })

  test('collects errors without stopping', async () => {
    const items = [1, 2, 3]
    const { results, errors } = await runWorkerPool(
      items,
      async (n) => {
        if (n === 2) throw new Error('boom')
        return n
      },
      { concurrency: 1 },
    )
    expect(results).toEqual([1, 3])
    expect(errors).toHaveLength(1)
    const err0 = errors[0]
    expect(err0).toBeDefined()
    expect(err0!.index).toBe(1)
    expect(err0!.error.message).toBe('boom')
  })

  test('progress callback', async () => {
    const progress: number[] = []
    await runWorkerPool([1, 2, 3], async (n) => n, {
      concurrency: 1,
      onProgress: (completed) => progress.push(completed),
    })
    expect(progress).toEqual([1, 2, 3])
  })
})

describe('createWriteMutex', () => {
  test('serializes concurrent writes', async () => {
    const order: number[] = []
    const mutex = createWriteMutex()

    await Promise.all([
      mutex.write(async () => {
        await new Promise((r) => setTimeout(r, 30))
        order.push(1)
      }),
      mutex.write(async () => {
        await new Promise((r) => setTimeout(r, 10))
        order.push(2)
      }),
      mutex.write(async () => {
        order.push(3)
      }),
    ])

    expect(order).toEqual([1, 2, 3])
  })
})

describe('createWorkspaceDir', () => {
  test('creates directory with sanitized name', async () => {
    const base = `${tmpdir()}/trial-ws-${Date.now()}`
    const dir = await createWorkspaceDir(base, 'test:prompt/1')
    expect(dir).toContain('prompt-test_prompt_1')
    const dirStat = await stat(dir)
    expect(dirStat.isDirectory()).toBe(true)
    // Cleanup
    await Bun.$`rm -rf ${base}`.quiet()
  })
})

describe('hasToolErrors', () => {
  test('returns false for empty trajectory', () => {
    expect(hasToolErrors([])).toBe(false)
  })

  test('returns false when no tool calls failed', () => {
    expect(
      hasToolErrors([
        { type: 'message', content: 'hello', timestamp: 0 },
        { type: 'tool_call', name: 'test', status: 'completed', timestamp: 0 },
      ]),
    ).toBe(false)
  })

  test('returns true when a tool call failed', () => {
    expect(hasToolErrors([{ type: 'tool_call', name: 'test', status: 'failed', timestamp: 0 }])).toBe(true)
  })
})

describe('detectRichness', () => {
  test('empty trajectory is minimal', () => {
    expect(detectRichness([])).toBe('minimal')
  })

  test('messages-only trajectory', () => {
    expect(detectRichness([{ type: 'message', content: 'hello', timestamp: 0 }])).toBe('messages-only')
  })

  test('trajectory with thoughts is full', () => {
    expect(
      detectRichness([
        { type: 'thought', content: 'thinking', timestamp: 0 },
        { type: 'message', content: 'hello', timestamp: 0 },
      ]),
    ).toBe('full')
  })

  test('trajectory with tool calls is full', () => {
    expect(detectRichness([{ type: 'tool_call', name: 'bash', status: 'completed', timestamp: 0 }])).toBe('full')
  })
})

// ============================================================================
// loadPolyglot (TS module)
// ============================================================================

describe('loadPolyglot', () => {
  test('loadAdapter from TS module', async () => {
    // Write a temporary adapter module
    const adapterPath = tempFile('echo-adapter.ts')
    await Bun.write(
      adapterPath,
      `export const adapt = async ({ prompt }) => ({
        output: Array.isArray(prompt) ? prompt.join(' ') : prompt,
      })`,
    )

    const { loadAdapter } = await import('../trial.utils.ts')
    const adapter = await loadAdapter(adapterPath)
    const result = await adapter({ prompt: 'hello' })
    expect(result.output).toBe('hello')
  })

  test('loadGrader from TS module', async () => {
    const graderPath = tempFile('pass-grader.ts')
    await Bun.write(
      graderPath,
      `export const grade = async ({ output }) => ({
        pass: output.length > 0,
        score: output.length > 0 ? 1.0 : 0.0,
      })`,
    )

    const { loadGrader } = await import('../trial.utils.ts')
    const grader = await loadGrader(graderPath)
    const result = await grader({ input: 'test', output: 'hello' })
    expect(result.pass).toBe(true)
    expect(result.score).toBe(1.0)
  })

  test('rejects module without expected export', async () => {
    const badPath = tempFile('bad-module.ts')
    await Bun.write(badPath, 'export const wrong = () => {}')

    const { loadAdapter } = await import('../trial.utils.ts')
    await expect(loadAdapter(badPath)).rejects.toThrow("Module must export a 'adapt' function")
  })

  test('rejects non-existent file', async () => {
    const { loadAdapter } = await import('../trial.utils.ts')
    await expect(loadAdapter('/nonexistent/adapter.ts')).rejects.toThrow('File not found')
  })
})
