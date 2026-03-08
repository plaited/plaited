import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RISK_TAG } from '../../../agent/agent.constants.ts'
import { ToolDefinitionSchema } from '../../../agent/agent.schemas.ts'
import type { ToolContext } from '../../../agent/agent.types.ts'
import {
  BUILT_IN_RISK_TAGS,
  bash,
  builtInHandlers,
  builtInToolSchemas,
  editFile,
  listFiles,
  readFile,
  writeFile,
} from '../crud.ts'

// ============================================================================
// Temp workspace setup
// ============================================================================

let workspace: string
let ctx: ToolContext

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'crud-test-'))
  ctx = { workspace, signal: new AbortController().signal }
  await Bun.write(join(workspace, 'hello.txt'), 'Hello, world!')
  await Bun.write(join(workspace, 'src/app.ts'), 'export const app = true')
  await Bun.write(join(workspace, 'unique.txt'), 'line one\nline two\nline three')
  await Bun.write(join(workspace, 'duplicate.txt'), 'foo bar foo baz')
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

// ============================================================================
// readFile
// ============================================================================

describe('readFile', () => {
  test('reads file content', async () => {
    const result = await readFile({ path: 'hello.txt' }, ctx)
    expect(result).toBe('Hello, world!')
  })

  test('reads nested file', async () => {
    const result = await readFile({ path: 'src/app.ts' }, ctx)
    expect(result).toBe('export const app = true')
  })

  test('throws for missing file', async () => {
    expect(readFile({ path: 'nonexistent.txt' }, ctx)).rejects.toThrow()
  })
})

// ============================================================================
// writeFile
// ============================================================================

describe('writeFile', () => {
  test('creates file with content', async () => {
    const result = (await writeFile({ path: 'output.txt', content: 'written data' }, ctx)) as {
      written: string
      bytes: number
    }
    expect(result.written).toBe('output.txt')
    expect(result.bytes).toBe(12)

    const content = await Bun.file(join(workspace, 'output.txt')).text()
    expect(content).toBe('written data')
  })
})

// ============================================================================
// editFile
// ============================================================================

describe('editFile', () => {
  test('replaces unique string', async () => {
    await Bun.write(join(workspace, 'edit-target.txt'), 'hello world')
    const result = (await editFile({ path: 'edit-target.txt', old_string: 'hello', new_string: 'goodbye' }, ctx)) as {
      edited: string
      bytes: number
    }

    expect(result.edited).toBe('edit-target.txt')
    const content = await Bun.file(join(workspace, 'edit-target.txt')).text()
    expect(content).toBe('goodbye world')
  })

  test('throws when old_string not found', async () => {
    expect(editFile({ path: 'hello.txt', old_string: 'nonexistent', new_string: 'replacement' }, ctx)).rejects.toThrow(
      'old_string not found',
    )
  })

  test('throws when old_string is not unique', async () => {
    expect(editFile({ path: 'duplicate.txt', old_string: 'foo', new_string: 'qux' }, ctx)).rejects.toThrow(
      'old_string is not unique',
    )
  })
})

// ============================================================================
// listFiles
// ============================================================================

describe('listFiles', () => {
  test('returns entries with metadata', async () => {
    const entries = (await listFiles({ pattern: '*.txt' }, ctx)) as Array<{
      path: string
      type: string
      size?: number
    }>
    const hello = entries.find((e) => e.path === 'hello.txt')
    expect(hello).toBeDefined()
    expect(hello!.type).toBe('file')
    expect(hello!.size).toBe(13) // 'Hello, world!' is 13 bytes
  })

  test('defaults to **/* when no pattern', async () => {
    const entries = (await listFiles({}, ctx)) as Array<{ path: string; type: string }>
    const paths = entries.map((e) => e.path)
    expect(paths).toContain('hello.txt')
  })
})

// ============================================================================
// bash
// ============================================================================

describe('bash', () => {
  test('executes command and returns stdout', async () => {
    const result = await bash({ command: 'echo hello' }, ctx)
    expect(result).toBe('hello')
  })

  test('throws on non-zero exit code', async () => {
    expect(bash({ command: 'ls /nonexistent_dir_12345' }, ctx)).rejects.toThrow()
  })

  test('executes in workspace directory', async () => {
    const result = await bash({ command: 'cat hello.txt' }, ctx)
    expect(result).toBe('Hello, world!')
  })

  test('throws when signal is already aborted', async () => {
    const aborted = AbortSignal.abort()
    expect(bash({ command: 'echo hi' }, { workspace, signal: aborted })).rejects.toThrow('Aborted')
  })
})

// ============================================================================
// builtInToolSchemas
// ============================================================================

describe('builtInToolSchemas', () => {
  test('each definition validates against ToolDefinitionSchema', () => {
    for (const def of builtInToolSchemas) {
      const result = ToolDefinitionSchema.safeParse(def)
      expect(result.success).toBe(true)
    }
  })

  test('includes all built-in tool names', () => {
    const names = builtInToolSchemas.map((s) => s.function.name)
    expect(names).toContain('read_file')
    expect(names).toContain('write_file')
    expect(names).toContain('edit_file')
    expect(names).toContain('list_files')
    expect(names).toContain('bash')
  })
})

// ============================================================================
// BUILT_IN_RISK_TAGS
// ============================================================================

describe('BUILT_IN_RISK_TAGS', () => {
  test('workspace tools have workspace tag', () => {
    expect(BUILT_IN_RISK_TAGS.read_file).toContain(RISK_TAG.workspace)
    expect(BUILT_IN_RISK_TAGS.write_file).toContain(RISK_TAG.workspace)
    expect(BUILT_IN_RISK_TAGS.edit_file).toContain(RISK_TAG.workspace)
    expect(BUILT_IN_RISK_TAGS.list_files).toContain(RISK_TAG.workspace)
  })

  test('bash has empty tags (default-deny)', () => {
    expect(BUILT_IN_RISK_TAGS.bash).toEqual([])
  })
})

// ============================================================================
// builtInHandlers
// ============================================================================

describe('builtInHandlers', () => {
  test('has handler for each tool schema', () => {
    const schemaNames = builtInToolSchemas.map((s) => s.function.name)
    for (const name of schemaNames) {
      expect(builtInHandlers[name]).toBeDefined()
    }
  })
})
