import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TOOL_STATUS } from '../agent.constants.ts'
import type { AgentToolCall } from '../agent.schemas.ts'
import { builtInToolSchemas, createToolExecutor } from '../agent.tools.ts'
import type { ToolHandler } from '../agent.types.ts'

// ============================================================================
// Temp workspace setup
// ============================================================================

let workspace: string

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'agent-tools-test-'))
  // Seed workspace with a test file
  await Bun.write(join(workspace, 'hello.txt'), 'Hello, world!')
  await Bun.write(join(workspace, 'src/app.ts'), 'export const app = true')
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

// ============================================================================
// Helpers
// ============================================================================

const makeToolCall = (name: string, args: Record<string, unknown> = {}): AgentToolCall => ({
  id: `tc-${name}-${Date.now()}`,
  name,
  arguments: args,
})

// ============================================================================
// createToolExecutor — dispatching
// ============================================================================

describe('createToolExecutor', () => {
  test('dispatches to correct handler', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('read_file', { path: 'hello.txt' }))
    expect(result.status).toBe(TOOL_STATUS.completed)
    expect(result.output).toBe('Hello, world!')
  })

  test('returns failed for unknown tool', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('nonexistent_tool', {}))
    expect(result.status).toBe(TOOL_STATUS.failed)
    expect(result.error).toContain('Unknown tool')
    expect(result.error).toContain('nonexistent_tool')
  })

  test('custom tools override built-in', async () => {
    const customReadFile: ToolHandler = async () => 'custom output'
    const executor = createToolExecutor({ workspace, tools: { read_file: customReadFile } })
    const result = await executor(makeToolCall('read_file', { path: 'hello.txt' }))
    expect(result.status).toBe(TOOL_STATUS.completed)
    expect(result.output).toBe('custom output')
  })

  test('includes duration in results', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('read_file', { path: 'hello.txt' }))
    expect(result.duration).toBeDefined()
    expect(result.duration).toBeGreaterThanOrEqual(0)
  })
})

// ============================================================================
// Built-in tools: read_file
// ============================================================================

describe('read_file', () => {
  test('reads file content', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('read_file', { path: 'hello.txt' }))
    expect(result.status).toBe(TOOL_STATUS.completed)
    expect(result.output).toBe('Hello, world!')
  })

  test('reads nested file', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('read_file', { path: 'src/app.ts' }))
    expect(result.status).toBe(TOOL_STATUS.completed)
    expect(result.output).toBe('export const app = true')
  })

  test('rejects path outside workspace', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('read_file', { path: '../../../etc/passwd' }))
    expect(result.status).toBe(TOOL_STATUS.failed)
    expect(result.error).toContain('outside workspace')
  })

  test('returns failed for missing file', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('read_file', { path: 'nonexistent.txt' }))
    expect(result.status).toBe(TOOL_STATUS.failed)
    expect(result.error).toBeDefined()
  })
})

// ============================================================================
// Built-in tools: write_file
// ============================================================================

describe('write_file', () => {
  test('creates file with content', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('write_file', { path: 'output.txt', content: 'written data' }))
    expect(result.status).toBe(TOOL_STATUS.completed)

    // Verify file was actually written
    const content = await Bun.file(join(workspace, 'output.txt')).text()
    expect(content).toBe('written data')
  })

  test('rejects path outside workspace', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('write_file', { path: '../../../tmp/evil.txt', content: 'bad' }))
    expect(result.status).toBe(TOOL_STATUS.failed)
    expect(result.error).toContain('outside workspace')
  })
})

// ============================================================================
// Built-in tools: list_files
// ============================================================================

describe('list_files', () => {
  test('returns matching paths', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('list_files', { pattern: '*.txt' }))
    expect(result.status).toBe(TOOL_STATUS.completed)
    const paths = result.output as string[]
    expect(paths).toContain('hello.txt')
  })

  test('defaults to **/* when no pattern', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('list_files', {}))
    expect(result.status).toBe(TOOL_STATUS.completed)
    const paths = result.output as string[]
    expect(paths.length).toBeGreaterThanOrEqual(2)
    expect(paths).toContain('hello.txt')
  })
})

// ============================================================================
// Built-in tools: bash
// ============================================================================

describe('bash', () => {
  test('executes command in workspace', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('bash', { command: 'echo hello' }))
    expect(result.status).toBe(TOOL_STATUS.completed)
    expect(result.output).toBe('hello')
  })

  test('rejects dangerous commands', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('bash', { command: 'sudo rm -rf /' }))
    expect(result.status).toBe(TOOL_STATUS.failed)
    expect(result.error).toContain('Dangerous command')
  })

  test('captures stderr on failure', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('bash', { command: 'ls /nonexistent_dir_12345' }))
    expect(result.status).toBe(TOOL_STATUS.failed)
    expect(result.error).toBeDefined()
  })
})

// ============================================================================
// builtInToolSchemas
// ============================================================================

describe('builtInToolSchemas', () => {
  test('has correct structure', () => {
    expect(builtInToolSchemas).toBeArray()
    expect(builtInToolSchemas.length).toBe(4)

    for (const schema of builtInToolSchemas) {
      expect(schema).toHaveProperty('type', 'function')
      expect(schema).toHaveProperty('function')
      const fn = schema.function as Record<string, unknown>
      expect(fn).toHaveProperty('name')
      expect(fn).toHaveProperty('description')
      expect(fn).toHaveProperty('parameters')
    }
  })

  test('includes all built-in tool names', () => {
    const names = builtInToolSchemas.map((s) => (s.function as Record<string, unknown>).name)
    expect(names).toContain('read_file')
    expect(names).toContain('write_file')
    expect(names).toContain('list_files')
    expect(names).toContain('bash')
  })
})
