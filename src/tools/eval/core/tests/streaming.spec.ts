/**
 * Unit tests for native streaming utilities.
 *
 * @remarks
 * Tests for memory-efficient streaming functions in streaming.ts:
 * - streamJsonl: Generic JSONL streaming with optional schema validation
 * - streamPrompts: PromptCase streaming
 * - streamResultsNative: CaptureResult streaming
 * - streamTrialResults: TrialResult streaming
 * - countLinesStreaming: Line counting without full file load
 *
 * @packageDocumentation
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { unlink } from 'node:fs/promises'
import { z } from 'zod'
import {
  countLinesStreaming,
  streamJsonl,
  streamPrompts,
  streamResultsNative,
  streamTrialResults,
} from '../streaming.ts'

// ============================================================================
// streamJsonl Tests
// ============================================================================

describe('streamJsonl', () => {
  const testFile = '/tmp/streaming-test-jsonl.jsonl'

  afterEach(async () => {
    try {
      await unlink(testFile)
    } catch {
      // Ignore if file doesn't exist
    }
  })

  test('streams items one at a time', async () => {
    await Bun.write(testFile, '{"a":1}\n{"a":2}\n{"a":3}')

    const items: Array<{ a: number }> = []
    for await (const item of streamJsonl<{ a: number }>(testFile)) {
      items.push(item)
    }

    expect(items.length).toBe(3)
    expect(items[0]?.a).toBe(1)
    expect(items[1]?.a).toBe(2)
    expect(items[2]?.a).toBe(3)
  })

  test('handles files without trailing newline', async () => {
    await Bun.write(testFile, '{"a":1}\n{"a":2}')

    const items: Array<{ a: number }> = []
    for await (const item of streamJsonl<{ a: number }>(testFile)) {
      items.push(item)
    }

    expect(items.length).toBe(2)
    expect(items[1]?.a).toBe(2)
  })

  test('validates with schema when provided', async () => {
    const schema = z.object({ id: z.string(), value: z.number() })
    await Bun.write(testFile, '{"id":"a","value":1}\n{"id":"b","value":2}')

    const items: Array<{ id: string; value: number }> = []
    for await (const item of streamJsonl(testFile, schema)) {
      items.push(item)
    }

    expect(items.length).toBe(2)
    expect(items[0]?.id).toBe('a')
    expect(items[0]?.value).toBe(1)
  })

  test('throws with line number on invalid JSON', async () => {
    await Bun.write(testFile, '{"a":1}\ninvalid json\n{"a":3}')

    const items: unknown[] = []
    let error: Error | undefined

    try {
      for await (const item of streamJsonl(testFile)) {
        items.push(item)
      }
    } catch (e) {
      error = e as Error
    }

    expect(error).toBeDefined()
    expect(error?.message).toContain('line 2')
  })

  test('throws with line number on schema validation failure', async () => {
    const schema = z.object({ id: z.string(), required: z.number() })
    await Bun.write(testFile, '{"id":"a","required":1}\n{"id":"b"}')

    const items: unknown[] = []
    let error: Error | undefined

    try {
      for await (const item of streamJsonl(testFile, schema)) {
        items.push(item)
      }
    } catch (e) {
      error = e as Error
    }

    expect(error).toBeDefined()
    expect(error?.message).toContain('line 2')
  })

  test('handles empty files', async () => {
    await Bun.write(testFile, '')

    const items: unknown[] = []
    for await (const item of streamJsonl(testFile)) {
      items.push(item)
    }

    expect(items.length).toBe(0)
  })

  test('handles single-line files', async () => {
    await Bun.write(testFile, '{"single":true}')

    const items: Array<{ single: boolean }> = []
    for await (const item of streamJsonl<{ single: boolean }>(testFile)) {
      items.push(item)
    }

    expect(items.length).toBe(1)
    expect(items[0]?.single).toBe(true)
  })

  test('skips empty lines', async () => {
    await Bun.write(testFile, '{"a":1}\n\n\n{"a":2}\n')

    const items: Array<{ a: number }> = []
    for await (const item of streamJsonl<{ a: number }>(testFile)) {
      items.push(item)
    }

    expect(items.length).toBe(2)
  })

  test('handles whitespace-only lines', async () => {
    await Bun.write(testFile, '{"a":1}\n   \n{"a":2}')

    const items: Array<{ a: number }> = []
    for await (const item of streamJsonl<{ a: number }>(testFile)) {
      items.push(item)
    }

    expect(items.length).toBe(2)
  })
})

// ============================================================================
// streamPrompts Tests
// ============================================================================

describe('streamPrompts', () => {
  const testFile = '/tmp/streaming-test-prompts.jsonl'

  afterEach(async () => {
    try {
      await unlink(testFile)
    } catch {
      // Ignore
    }
  })

  test('yields validated PromptCase objects', async () => {
    await Bun.write(testFile, '{"id":"p1","input":"hello"}\n{"id":"p2","input":"world"}')

    const prompts = []
    for await (const prompt of streamPrompts(testFile)) {
      prompts.push(prompt)
    }

    expect(prompts.length).toBe(2)
    expect(prompts[0]?.id).toBe('p1')
    expect(prompts[0]?.input).toBe('hello')
  })

  test('handles multi-turn prompts', async () => {
    await Bun.write(testFile, '{"id":"m1","input":["turn1","turn2"]}')

    const prompts = []
    for await (const prompt of streamPrompts(testFile)) {
      prompts.push(prompt)
    }

    expect(prompts.length).toBe(1)
    expect(Array.isArray(prompts[0]?.input)).toBe(true)
  })

  test('throws on schema validation failure', async () => {
    // Missing required 'id' field
    await Bun.write(testFile, '{"input":"hello"}')

    let error: Error | undefined
    try {
      for await (const _ of streamPrompts(testFile)) {
        // Consume
      }
    } catch (e) {
      error = e as Error
    }

    expect(error).toBeDefined()
    expect(error?.message).toContain('line 1')
  })
})

// ============================================================================
// streamResultsNative Tests
// ============================================================================

describe('streamResultsNative', () => {
  const testFile = '/tmp/streaming-test-results.jsonl'

  afterEach(async () => {
    try {
      await unlink(testFile)
    } catch {
      // Ignore
    }
  })

  test('yields validated CaptureResult objects', async () => {
    const result = {
      id: 'r1',
      input: 'test',
      output: 'result',
      trajectory: [],
      metadata: {},
      toolErrors: false,
      timing: {
        start: 0,
        end: 100,
        total: 100,
        sessionCreation: 10,
      },
    }
    await Bun.write(testFile, JSON.stringify(result))

    const results = []
    for await (const r of streamResultsNative(testFile)) {
      results.push(r)
    }

    expect(results.length).toBe(1)
    expect(results[0]?.id).toBe('r1')
    expect(results[0]?.output).toBe('result')
  })

  test('streams multiple results', async () => {
    const makeResult = (id: string) => ({
      id,
      input: 'test',
      output: 'result',
      trajectory: [],
      metadata: {},
      toolErrors: false,
      timing: { start: 0, end: 100, total: 100, sessionCreation: 10 },
    })

    await Bun.write(
      testFile,
      `${JSON.stringify(makeResult('r1'))}\n${JSON.stringify(makeResult('r2'))}\n${JSON.stringify(makeResult('r3'))}`,
    )

    const results = []
    for await (const r of streamResultsNative(testFile)) {
      results.push(r)
    }

    expect(results.length).toBe(3)
    expect(results.map((r) => r.id)).toEqual(['r1', 'r2', 'r3'])
  })
})

// ============================================================================
// streamTrialResults Tests
// ============================================================================

describe('streamTrialResults', () => {
  const testFile = '/tmp/streaming-test-trials.jsonl'

  afterEach(async () => {
    try {
      await unlink(testFile)
    } catch {
      // Ignore
    }
  })

  test('yields validated TrialResult objects', async () => {
    const trialResult = {
      id: 't1',
      input: 'test prompt',
      k: 3,
      passRate: 0.67,
      passAtK: 1,
      passExpK: 0.7,
      trials: [
        { trialNum: 1, output: 'output1', trajectory: [], duration: 100, pass: true },
        { trialNum: 2, output: 'output2', trajectory: [], duration: 150, pass: true },
        { trialNum: 3, output: 'output3', trajectory: [], duration: 120, pass: false },
      ],
    }
    await Bun.write(testFile, JSON.stringify(trialResult))

    const results = []
    for await (const r of streamTrialResults(testFile)) {
      results.push(r)
    }

    expect(results.length).toBe(1)
    expect(results[0]?.id).toBe('t1')
    expect(results[0]?.k).toBe(3)
    expect(results[0]?.passRate).toBe(0.67)
  })

  test('throws on invalid trial result', async () => {
    // Missing required 'k' field
    await Bun.write(testFile, '{"id":"t1","input":"test","trials":[]}')

    let error: Error | undefined
    try {
      for await (const _ of streamTrialResults(testFile)) {
        // Consume
      }
    } catch (e) {
      error = e as Error
    }

    expect(error).toBeDefined()
    expect(error?.message).toContain('line 1')
  })
})

// ============================================================================
// countLinesStreaming Tests
// ============================================================================

describe('countLinesStreaming', () => {
  const testFile = '/tmp/streaming-test-count.jsonl'

  afterEach(async () => {
    try {
      await unlink(testFile)
    } catch {
      // Ignore
    }
  })

  test('counts lines without loading full file', async () => {
    await Bun.write(testFile, '{"a":1}\n{"a":2}\n{"a":3}')

    const count = await countLinesStreaming(testFile)
    expect(count).toBe(3)
  })

  test('handles empty file', async () => {
    await Bun.write(testFile, '')

    const count = await countLinesStreaming(testFile)
    expect(count).toBe(0)
  })

  test('handles file without trailing newline', async () => {
    await Bun.write(testFile, '{"a":1}\n{"a":2}')

    const count = await countLinesStreaming(testFile)
    expect(count).toBe(2)
  })

  test('skips empty lines', async () => {
    await Bun.write(testFile, '{"a":1}\n\n{"a":2}\n\n')

    const count = await countLinesStreaming(testFile)
    expect(count).toBe(2)
  })

  test('handles single-line file', async () => {
    await Bun.write(testFile, '{"single":true}')

    const count = await countLinesStreaming(testFile)
    expect(count).toBe(1)
  })
})
