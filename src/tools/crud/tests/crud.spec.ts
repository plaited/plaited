import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { TOOL_STATUS } from '../../../agent/agent.constants.ts'
import { type AgentToolCall, ToolDefinitionSchema } from '../../../agent/agent.schemas.ts'
import type { ToolHandler } from '../../../agent/agent.types.ts'
import { createMemoryDb, createSearchHandler, searchToolSchema } from '../../memory/memory.ts'
import type { MemoryDb } from '../../memory/memory.types.ts'
import { builtInToolSchemas, createToolExecutor } from '../crud.ts'

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
})

// ============================================================================
// Built-in tools: list_files
// ============================================================================

type FileEntry = { path: string; type: 'file' | 'directory'; size?: number }

describe('list_files', () => {
  test('returns entries with metadata', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('list_files', { pattern: '*.txt' }))
    expect(result.status).toBe(TOOL_STATUS.completed)
    const entries = result.output as FileEntry[]
    const hello = entries.find((e) => e.path === 'hello.txt')
    expect(hello).toBeDefined()
    expect(hello!.type).toBe('file')
    expect(hello!.size).toBe(13) // 'Hello, world!' is 13 bytes
  })

  test('defaults to **/* when no pattern', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('list_files', {}))
    expect(result.status).toBe(TOOL_STATUS.completed)
    const entries = result.output as FileEntry[]
    expect(entries.length).toBeGreaterThanOrEqual(2)
    const paths = entries.map((e) => e.path)
    expect(paths).toContain('hello.txt')
  })

  test('includes directories when scanning with onlyFiles false', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('list_files', { pattern: '**/*' }))
    expect(result.status).toBe(TOOL_STATUS.completed)
    const entries = result.output as FileEntry[]
    const srcDir = entries.find((e) => e.path === 'src' && e.type === 'directory')
    expect(srcDir).toBeDefined()
    expect(srcDir!.size).toBeUndefined()
  })

  test('file entries include size in bytes', async () => {
    const executor = createToolExecutor({ workspace })
    const result = await executor(makeToolCall('list_files', { pattern: 'src/**' }))
    expect(result.status).toBe(TOOL_STATUS.completed)
    const entries = result.output as FileEntry[]
    const appFile = entries.find((e) => e.path === 'src/app.ts')
    expect(appFile).toBeDefined()
    expect(appFile!.type).toBe('file')
    expect(appFile!.size).toBe(23) // 'export const app = true' is 23 bytes
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
  test('each definition validates against ToolDefinitionSchema', () => {
    expect(builtInToolSchemas).toBeArray()
    expect(builtInToolSchemas.length).toBe(4)

    for (const def of builtInToolSchemas) {
      const result = ToolDefinitionSchema.safeParse(def)
      expect(result.success).toBe(true)
    }
  })

  test('includes all built-in tool names', () => {
    const names = builtInToolSchemas.map((s) => s.function.name)
    expect(names).toContain('read_file')
    expect(names).toContain('write_file')
    expect(names).toContain('list_files')
    expect(names).toContain('bash')
  })
})

// ============================================================================
// searchToolSchema
// ============================================================================

describe('searchToolSchema', () => {
  test('validates against ToolDefinitionSchema', () => {
    const result = ToolDefinitionSchema.safeParse(searchToolSchema)
    expect(result.success).toBe(true)
  })

  test('has correct name', () => {
    expect(searchToolSchema.function.name).toBe('search')
  })
})

// ============================================================================
// search tool — integration with createToolExecutor
// ============================================================================

describe('search tool — integration', () => {
  let searchWorkspace: string
  let memory: MemoryDb

  beforeAll(async () => {
    searchWorkspace = await mkdtemp(join(tmpdir(), 'search-tool-test-'))
    await Bun.write(join(searchWorkspace, 'src/auth.ts'), 'export const authenticate = (user: string) => true')
    await Bun.write(join(searchWorkspace, 'src/db.ts'), 'export const connectDatabase = () => new Pool()')
  })

  afterAll(async () => {
    memory?.close()
    await rm(searchWorkspace, { recursive: true, force: true })
  })

  test('search tool works through createToolExecutor', async () => {
    memory = createMemoryDb({ path: ':memory:', workspace: searchWorkspace })
    const handler = createSearchHandler(memory)
    const executor = createToolExecutor({ workspace: searchWorkspace, tools: { search: handler } })

    const result = await executor(makeToolCall('search', { query: 'authenticate' }))
    expect(result.status).toBe(TOOL_STATUS.completed)
    const output = result.output as { query: string; count: number; results: unknown[] }
    expect(output.count).toBe(1)
    expect(output.results).toHaveLength(1)
  })

  test('search tool returns no results gracefully', async () => {
    memory = createMemoryDb({ path: ':memory:', workspace: searchWorkspace })
    const handler = createSearchHandler(memory)
    const executor = createToolExecutor({ workspace: searchWorkspace, tools: { search: handler } })

    const result = await executor(makeToolCall('search', { query: 'zzz_nonexistent_term' }))
    expect(result.status).toBe(TOOL_STATUS.completed)
    const output = result.output as { message: string; results: unknown[] }
    expect(output.message).toBe('No results found')
  })
})
