/**
 * Tests for trial adapters — CLI adapter factory and local adapter.
 *
 * @remarks
 * Covers: CLI adapter schema loading, event mapping, JSONPath extraction,
 * local adapter lifecycle (connect → task → message), persistTrialResults.
 */

import { afterEach, describe, expect, test } from 'bun:test'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Model } from '../../agent/agent.types.ts'
import type { TrialResult } from '../trial.schemas.ts'
import { createCliAdapter, loadAdapterSchema } from '../adapters/cli-adapter.ts'
import { createLocalAdapter } from '../adapters/local.ts'
import { persistTrialResults } from '../trial.utils.ts'

// ============================================================================
// CLI Adapter Schema
// ============================================================================

describe('CLI adapter schema', () => {
  test('loadAdapterSchema loads claude-code.json', async () => {
    const schemaPath = join(import.meta.dir, '../adapters/claude-code.json')
    const schema = await loadAdapterSchema(schemaPath)
    expect(schema.name).toBe('claude-code')
    expect(schema.command).toContain('claude')
    expect(schema.streamFormat).toBe('ndjson')
    expect(schema.eventMapping.message).toBeDefined()
    expect(schema.eventMapping.tool_call).toBeDefined()
    expect(schema.eventMapping.result).toBeDefined()
  })

  test('loadAdapterSchema loads codex.json', async () => {
    const schemaPath = join(import.meta.dir, '../adapters/codex.json')
    const schema = await loadAdapterSchema(schemaPath)
    expect(schema.name).toBe('codex')
    expect(schema.command).toContain('codex')
    expect(schema.eventMapping.tool_call?.match).toHaveProperty('type', 'function_call')
  })

  test('loadAdapterSchema loads gemini.json', async () => {
    const schemaPath = join(import.meta.dir, '../adapters/gemini.json')
    const schema = await loadAdapterSchema(schemaPath)
    expect(schema.name).toBe('gemini')
    expect(schema.command).toContain('gemini')
  })

  test('loadAdapterSchema throws on missing file', async () => {
    await expect(loadAdapterSchema('/nonexistent/file.json')).rejects.toThrow('not found')
  })
})

// ============================================================================
// CLI Adapter Event Mapping
// ============================================================================

describe('createCliAdapter', () => {
  test('creates adapter from schema config', () => {
    const adapter = createCliAdapter({
      name: 'test',
      command: ['echo', '{"type":"result","text":"hello"}'],
      streamFormat: 'ndjson',
      eventMapping: {
        result: {
          match: { type: 'result' },
          output: '$.text',
        },
      },
    })
    expect(typeof adapter).toBe('function')
  })

  test('parses ndjson stdout with message events', async () => {
    // Use echo to simulate agent output
    const adapter = createCliAdapter({
      name: 'echo-test',
      command: ['echo', '{"type":"text","text":"hello world"}'],
      streamFormat: 'ndjson',
      eventMapping: {
        message: {
          match: { type: 'text' },
          content: '$.text',
        },
      },
    })

    const result = await adapter({ prompt: 'test' })
    expect(result.output).toContain('hello world')
    expect(result.trajectory).toBeDefined()
    expect(result.trajectory?.[0]?.type).toBe('message')
  })

  test('extracts result event with usage', async () => {
    const events = [
      '{"type":"text","text":"output text"}',
      '{"type":"result","text":"final","usage":{"input_tokens":100,"output_tokens":50}}',
    ].join('\n')

    const adapter = createCliAdapter({
      name: 'usage-test',
      command: ['printf', events],
      streamFormat: 'ndjson',
      eventMapping: {
        message: {
          match: { type: 'text' },
          content: '$.text',
        },
        result: {
          match: { type: 'result' },
          output: '$.text',
          inputTokens: '$.usage.input_tokens',
          outputTokens: '$.usage.output_tokens',
        },
      },
    })

    const result = await adapter({ prompt: 'test' })
    expect(result.output).toBe('final')
    expect(result.timing?.inputTokens).toBe(100)
    expect(result.timing?.outputTokens).toBe(50)
  })

  test('handles timeout exit codes', async () => {
    const adapter = createCliAdapter({
      name: 'timeout-test',
      command: ['false'], // exits with code 1
      streamFormat: 'ndjson',
      eventMapping: {},
      exitCodeMapping: { success: [0], timeout: [1] },
    })

    const result = await adapter({ prompt: 'test' })
    expect(result.timedOut).toBe(true)
    expect(result.exitCode).toBe(1)
  })
})

// ============================================================================
// Local Adapter
// ============================================================================

describe('createLocalAdapter', () => {
  test('creates adapter function', () => {
    const adapter = createLocalAdapter({
      model: createMockModel('hello'),
      tools: [],
      toolExecutor: async () => 'ok',
      memoryPath: join(tmpdir(), 'test-memory-' + Date.now()),
    })
    expect(typeof adapter).toBe('function')
  })

  test('runs prompt through agent loop and returns result', async () => {
    const adapter = createLocalAdapter({
      model: createMockModel('Test response'),
      tools: [],
      toolExecutor: async () => 'ok',
      memoryPath: join(tmpdir(), 'test-memory-' + Date.now()),
      maxIterations: 5,
    })

    const result = await adapter({ prompt: 'Say hello' })
    expect(result.output).toBe('Test response')
    expect(result.exitCode).toBe(0)
    expect(result.timing?.total).toBeGreaterThan(0)
    expect(result.trajectory).toBeDefined()
    expect(result.trajectory?.some((s) => s.type === 'message')).toBe(true)
  })

  test('handles multi-turn prompts', async () => {
    const adapter = createLocalAdapter({
      model: createMockModel('Multi response'),
      tools: [],
      toolExecutor: async () => 'ok',
      memoryPath: join(tmpdir(), 'test-memory-' + Date.now()),
    })

    const result = await adapter({ prompt: ['First turn', 'Second turn'] })
    expect(result.output).toBe('Multi response')
  })

  test('returns error result on model failure', async () => {
    const adapter = createLocalAdapter({
      model: createFailingModel(),
      tools: [],
      toolExecutor: async () => 'ok',
      memoryPath: join(tmpdir(), 'test-memory-' + Date.now()),
      maxIterations: 1,
    })

    const result = await adapter({ prompt: 'Should fail' })
    // Agent loop handles errors internally — either returns error message or times out
    expect(result.output).toBeTruthy()
    expect(result.timing?.total).toBeGreaterThanOrEqual(0)
  })
})

// ============================================================================
// persistTrialResults
// ============================================================================

describe('persistTrialResults', () => {
  const tmpBase = join(tmpdir(), `eval-persist-test-${Date.now()}`)
  const memoryPath = join(tmpBase, '.memory')

  afterEach(async () => {
    await rm(tmpBase, { recursive: true, force: true })
  })

  test('writes JSONL to .memory/evals/', async () => {
    const results: TrialResult[] = [
      {
        id: 'test-1',
        input: 'hello',
        k: 1,
        trials: [{ trialNum: 1, output: 'world', duration: 100 }],
      },
      {
        id: 'test-2',
        input: 'foo',
        k: 1,
        trials: [{ trialNum: 1, output: 'bar', duration: 200 }],
      },
    ]

    const { path, timestamp } = await persistTrialResults(results, memoryPath)

    expect(path).toContain('.memory/evals/trial-')
    expect(path).toEndWith('.jsonl')
    expect(timestamp).toBeTruthy()

    // Verify file content
    const content = await Bun.file(path).text()
    const lines = content.trim().split('\n')
    expect(lines).toHaveLength(2)

    const parsed1 = JSON.parse(lines[0]!)
    expect(parsed1.id).toBe('test-1')
    expect(parsed1.trials[0].output).toBe('world')

    const parsed2 = JSON.parse(lines[1]!)
    expect(parsed2.id).toBe('test-2')
  })

  test('creates eval directory if missing', async () => {
    const results: TrialResult[] = [
      {
        id: 'create-dir',
        input: 'test',
        k: 1,
        trials: [{ trialNum: 1, output: 'out', duration: 50 }],
      },
    ]

    const { path } = await persistTrialResults(results, memoryPath)
    const exists = await Bun.file(path).exists()
    expect(exists).toBe(true)
  })
})

// ============================================================================
// Mock Model Helpers
// ============================================================================

/**
 * Create a mock Model that returns a simple text response.
 *
 * @remarks
 * Simulates the streaming interface: text_delta → done.
 * Uses the ModelUsage schema shape (camelCase: inputTokens, outputTokens).
 */
const createMockModel = (response: string): Model => ({
  reason: async function* () {
    yield { type: 'text_delta' as const, content: response }
    yield {
      type: 'done' as const,
      response: { usage: { inputTokens: 10, outputTokens: 5 } },
    }
  },
})

/**
 * Create a mock Model that always errors.
 */
const createFailingModel = (): Model => ({
  reason: async function* () {
    yield { type: 'error' as const, error: 'Model crashed' }
  },
})
