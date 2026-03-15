import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RISK_TAG } from '../../agent/agent.constants.ts'
import type { ToolContext } from '../../agent/agent.types.ts'
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

  // ---------------------------------------------------------------------------
  // Whitespace normalization fallback
  // ---------------------------------------------------------------------------

  test('matches with trailing whitespace differences', async () => {
    await Bun.write(join(workspace, 'ws-target.ts'), 'export const x = 1  \nexport const y = 2\t\n')
    const result = (await editFile(
      { path: 'ws-target.ts', old_string: 'export const x = 1\nexport const y = 2\n', new_string: 'export const x = 10\nexport const y = 20\n' },
      ctx,
    )) as { edited: string; bytes: number }

    expect(result.edited).toBe('ws-target.ts')
    const content = await Bun.file(join(workspace, 'ws-target.ts')).text()
    expect(content).toBe('export const x = 10\nexport const y = 20\n')
  })

  test('throws on non-unique after normalization', async () => {
    // Both occurrences have trailing whitespace so exact match fails,
    // but normalized match finds two hits
    await Bun.write(join(workspace, 'ws-dup.txt'), 'abc  \ndef\nabc \ndef')
    expect(
      editFile({ path: 'ws-dup.txt', old_string: 'abc\ndef', new_string: 'replaced' }, ctx),
    ).rejects.toThrow('not unique')
  })

  // ---------------------------------------------------------------------------
  // Symbol-scoped search
  // ---------------------------------------------------------------------------

  test('scopes edit to named export symbol', async () => {
    const source = [
      'export const alpha = "hello"',
      '',
      'export const beta = "hello"',
      '',
      'export const gamma = 42',
    ].join('\n')
    await Bun.write(join(workspace, 'symbols.ts'), source)

    // "hello" appears in both alpha and beta — without symbol it would be ambiguous
    const result = (await editFile(
      { path: 'symbols.ts', old_string: '"hello"', new_string: '"goodbye"', symbol: 'beta' },
      ctx,
    )) as { edited: string; bytes: number }

    expect(result.edited).toBe('symbols.ts')
    const content = await Bun.file(join(workspace, 'symbols.ts')).text()
    expect(content).toContain('export const alpha = "hello"')
    expect(content).toContain('export const beta = "goodbye"')
  })

  test('throws when symbol not found as export', async () => {
    await Bun.write(join(workspace, 'no-sym.ts'), 'export const a = 1')
    expect(
      editFile({ path: 'no-sym.ts', old_string: '1', new_string: '2', symbol: 'missing' }, ctx),
    ).rejects.toThrow("Symbol 'missing' not found as export")
  })

  test('symbol-scoped edit with trailing whitespace normalization', async () => {
    const source = 'export const foo = "bar"  \n\nexport const baz = "qux"'
    await Bun.write(join(workspace, 'sym-ws.ts'), source)

    const result = (await editFile(
      { path: 'sym-ws.ts', old_string: 'export const foo = "bar"\n', new_string: 'export const foo = "baz"\n', symbol: 'foo' },
      ctx,
    )) as { edited: string; bytes: number }

    expect(result.edited).toBe('sym-ws.ts')
    const content = await Bun.file(join(workspace, 'sym-ws.ts')).text()
    expect(content).toContain('export const foo = "baz"')
    expect(content).toContain('export const baz = "qux"')
  })

  // ---------------------------------------------------------------------------
  // Post-edit syntax validation
  // ---------------------------------------------------------------------------

  test('rejects edits that produce invalid syntax in TS files', async () => {
    await Bun.write(join(workspace, 'valid.ts'), 'export const x = 1')
    expect(
      editFile({ path: 'valid.ts', old_string: 'export const x = 1', new_string: 'export const x =' }, ctx),
    ).rejects.toThrow('invalid syntax')
  })

  test('skips syntax validation for non-TS/JS files', async () => {
    await Bun.write(join(workspace, 'data.json'), '{"key": "old"}')
    const result = (await editFile(
      { path: 'data.json', old_string: '"old"', new_string: '"new"' },
      ctx,
    )) as { edited: string; bytes: number }

    expect(result.edited).toBe('data.json')
    const content = await Bun.file(join(workspace, 'data.json')).text()
    expect(content).toBe('{"key": "new"}')
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
