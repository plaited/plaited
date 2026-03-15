import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RISK_TAG } from '../../agent/agent.constants.ts'
import type { ToolContext } from '../../agent/agent.types.ts'
import type { TruncationResult } from '../truncate.ts'
import { BUILT_IN_RISK_TAGS, bash, builtInHandlers, editFile, listFiles, readFile, writeFile } from '../crud.ts'

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
  // Binary test files
  await Bun.write(join(workspace, 'image.png'), new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
  await Bun.write(join(workspace, 'data.bin'), new Uint8Array([0x00, 0x01, 0x02, 0x03]))
  // Large file for truncation testing
  const largeContent = Array.from({ length: 3000 }, (_, i) => `line ${i}`).join('\n')
  await Bun.write(join(workspace, 'large.txt'), largeContent)
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

// ============================================================================
// readFile
// ============================================================================

describe('readFile', () => {
  test('reads text file with truncation metadata', async () => {
    const result = (await readFile({ path: 'hello.txt' }, ctx)) as {
      type: string
      path: string
      content: string
      truncated: boolean
    }
    expect(result.type).toBe('text')
    expect(result.path).toBe('hello.txt')
    expect(result.content).toBe('Hello, world!')
    expect(result.truncated).toBe(false)
  })

  test('reads nested file', async () => {
    const result = (await readFile({ path: 'src/app.ts' }, ctx)) as {
      type: string
      content: string
    }
    expect(result.type).toBe('text')
    expect(result.content).toBe('export const app = true')
  })

  test('throws for missing file', async () => {
    expect(readFile({ path: 'nonexistent.txt' }, ctx)).rejects.toThrow()
  })

  test('truncates large files', async () => {
    const result = (await readFile({ path: 'large.txt' }, ctx)) as {
      type: string
      truncated: boolean
      totalLines: number
      outputLines: number
    }
    expect(result.type).toBe('text')
    expect(result.truncated).toBe(true)
    expect(result.totalLines).toBe(3000)
    expect(result.outputLines).toBeLessThanOrEqual(2001) // 2000 lines + possible partial
  })

  test('supports offset parameter', async () => {
    const result = (await readFile({ path: 'unique.txt', offset: 1 }, ctx)) as {
      type: string
      content: string
    }
    expect(result.type).toBe('text')
    expect(result.content).toBe('line two\nline three')
  })

  test('supports limit parameter', async () => {
    const result = (await readFile({ path: 'unique.txt', limit: 2 }, ctx)) as {
      type: string
      content: string
    }
    expect(result.type).toBe('text')
    expect(result.content).toBe('line one\nline two')
  })

  test('supports offset + limit together', async () => {
    const result = (await readFile({ path: 'unique.txt', offset: 1, limit: 1 }, ctx)) as {
      type: string
      content: string
    }
    expect(result.type).toBe('text')
    expect(result.content).toBe('line two')
  })

  test('returns image metadata for image files', async () => {
    const result = (await readFile({ path: 'image.png' }, ctx)) as {
      type: string
      mimeType: string
      size: number
    }
    expect(result.type).toBe('image')
    expect(result.mimeType).toBe('image/png')
    expect(result.size).toBe(4)
  })

  test('returns binary metadata for non-text files', async () => {
    const result = (await readFile({ path: 'data.bin' }, ctx)) as {
      type: string
      mimeType: string
      size: number
    }
    expect(result.type).toBe('binary')
    expect(result.size).toBe(4)
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
  test('returns entries with metadata and truncation info', async () => {
    const result = (await listFiles({ pattern: '*.txt' }, ctx)) as {
      entries: Array<{ path: string; type: string; size?: number }>
      truncated: boolean
      totalEntries: number
      returnedEntries: number
    }
    const hello = result.entries.find((e) => e.path === 'hello.txt')
    expect(hello).toBeDefined()
    expect(hello!.type).toBe('file')
    expect(hello!.size).toBe(13) // 'Hello, world!' is 13 bytes
    expect(result.truncated).toBe(false)
    expect(result.totalEntries).toBe(result.returnedEntries)
  })

  test('defaults to **/* when no pattern', async () => {
    const result = (await listFiles({}, ctx)) as {
      entries: Array<{ path: string; type: string }>
    }
    const paths = result.entries.map((e) => e.path)
    expect(paths).toContain('hello.txt')
  })

  test('respects limit parameter', async () => {
    const result = (await listFiles({ pattern: '*.txt', limit: 1 }, ctx)) as {
      entries: Array<{ path: string }>
      truncated: boolean
      totalEntries: number
      returnedEntries: number
    }
    expect(result.returnedEntries).toBe(1)
    expect(result.entries).toHaveLength(1)
    expect(result.truncated).toBe(true)
    expect(result.totalEntries).toBeGreaterThan(1)
  })
})

// ============================================================================
// bash
// ============================================================================

describe('bash', () => {
  test('executes command and returns truncation result', async () => {
    const result = (await bash({ command: 'echo hello' }, ctx)) as TruncationResult
    expect(result.content).toBe('hello')
    expect(result.truncated).toBe(false)
    expect(result.totalLines).toBe(1)
  })

  test('throws on non-zero exit code', async () => {
    expect(bash({ command: 'ls /nonexistent_dir_12345' }, ctx)).rejects.toThrow()
  })

  test('executes in workspace directory', async () => {
    const result = (await bash({ command: 'cat hello.txt' }, ctx)) as TruncationResult
    expect(result.content).toBe('Hello, world!')
  })

  test('throws when signal is already aborted', async () => {
    const aborted = AbortSignal.abort()
    expect(bash({ command: 'echo hi' }, { workspace, signal: aborted })).rejects.toThrow('Aborted')
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
  test('has handler for all built-in tools', () => {
    expect(builtInHandlers.read_file).toBeDefined()
    expect(builtInHandlers.write_file).toBeDefined()
    expect(builtInHandlers.edit_file).toBeDefined()
    expect(builtInHandlers.list_files).toBeDefined()
    expect(builtInHandlers.bash).toBeDefined()
  })
})
