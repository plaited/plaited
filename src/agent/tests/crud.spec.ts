import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { RISK_TAG } from '../agent.constants.ts'
import type { ToolContext } from '../agent.types.ts'
import {
  AGENT_CRUD_RISK_TAGS,
  agentCrudHandlers,
  bash,
  editFile,
  grep,
  listFiles,
  readFile,
  writeFile,
} from '../crud.ts'
import type { TruncationResult } from '../truncate.ts'

let workspace: string
let ctx: ToolContext

beforeAll(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'crud-test-'))
  ctx = { workspace, env: {}, signal: new AbortController().signal }
  await Bun.write(join(workspace, 'hello.txt'), 'Hello, world!')
  await Bun.write(join(workspace, 'src/app.ts'), 'export const app = true')
  await Bun.write(join(workspace, 'unique.txt'), 'line one\nline two\nline three')
  await Bun.write(join(workspace, 'duplicate.txt'), 'foo bar foo baz')
  await Bun.write(join(workspace, 'image.png'), new Uint8Array([0x89, 0x50, 0x4e, 0x47]))
  await Bun.write(join(workspace, 'data.bin'), new Uint8Array([0x00, 0x01, 0x02, 0x03]))
  const largeContent = Array.from({ length: 3000 }, (_, i) => `line ${i}`).join('\n')
  await Bun.write(join(workspace, 'large.txt'), largeContent)
  await Bun.write(
    join(workspace, 'search-target.ts'),
    'const alpha = 1\nconst beta = 2\nconst ALPHA = 3\nfunction gamma() { return alpha + beta }',
  )
})

afterAll(async () => {
  await rm(workspace, { recursive: true, force: true })
})

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
    expect(result.outputLines).toBeLessThanOrEqual(2001)
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

describe('writeFile', () => {
  test('creates file with content', async () => {
    const result = (await writeFile({ path: 'output.txt', content: 'written data' }, ctx)) as {
      written: string
      bytes: number
    }
    expect(result.written).toBe('output.txt')
    expect(result.bytes).toBe(12)
    expect(await Bun.file(join(workspace, 'output.txt')).text()).toBe('written data')
  })
})

describe('editFile', () => {
  test('replaces unique string', async () => {
    await Bun.write(join(workspace, 'edit-target.txt'), 'hello world')
    const result = (await editFile({ path: 'edit-target.txt', old_string: 'hello', new_string: 'goodbye' }, ctx)) as {
      edited: string
    }

    expect(result.edited).toBe('edit-target.txt')
    expect(await Bun.file(join(workspace, 'edit-target.txt')).text()).toBe('goodbye world')
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

  test('matches with trailing whitespace differences', async () => {
    await Bun.write(join(workspace, 'ws-target.ts'), 'export const x = 1  \nexport const y = 2\t\n')
    const result = (await editFile(
      {
        path: 'ws-target.ts',
        old_string: 'export const x = 1\nexport const y = 2\n',
        new_string: 'export const x = 10\nexport const y = 20\n',
      },
      ctx,
    )) as { edited: string }

    expect(result.edited).toBe('ws-target.ts')
    expect(await Bun.file(join(workspace, 'ws-target.ts')).text()).toBe('export const x = 10\nexport const y = 20\n')
  })

  test('throws on non-unique after normalization', async () => {
    await Bun.write(join(workspace, 'ws-dup.txt'), 'abc  \ndef\nabc \ndef')
    expect(editFile({ path: 'ws-dup.txt', old_string: 'abc\ndef', new_string: 'replaced' }, ctx)).rejects.toThrow(
      'not unique',
    )
  })

  test('scopes edit to named export symbol', async () => {
    const source = [
      'export const alpha = "hello"',
      '',
      'export const beta = "hello"',
      '',
      'export const gamma = 42',
    ].join('\n')
    await Bun.write(join(workspace, 'scoped.ts'), source)

    const result = (await editFile(
      { path: 'scoped.ts', old_string: '"hello"', new_string: '"goodbye"', symbol: 'beta' },
      ctx,
    )) as { edited: string }

    expect(result.edited).toBe('scoped.ts')
    expect(await Bun.file(join(workspace, 'scoped.ts')).text()).toContain('export const alpha = "hello"')
    expect(await Bun.file(join(workspace, 'scoped.ts')).text()).toContain('export const beta = "goodbye"')
  })

  test('throws when symbol export is missing', async () => {
    await Bun.write(join(workspace, 'no-sym.ts'), 'export const present = 1')
    expect(editFile({ path: 'no-sym.ts', old_string: '1', new_string: '2', symbol: 'missing' }, ctx)).rejects.toThrow(
      "Symbol 'missing' not found",
    )
  })

  test('rejects invalid syntax for transpiled files', async () => {
    await Bun.write(join(workspace, 'valid.ts'), 'export const x = 1')
    expect(
      editFile({ path: 'valid.ts', old_string: 'export const x = 1', new_string: 'export const x =' }, ctx),
    ).rejects.toThrow('invalid syntax')
  })
})

describe('listFiles', () => {
  test('lists files matching glob', async () => {
    const result = (await listFiles({ pattern: '*.txt' }, ctx)) as {
      entries: Array<{ path: string }>
      truncated: boolean
    }
    expect(result.entries.some((entry) => entry.path === 'hello.txt')).toBe(true)
    expect(result.truncated).toBe(false)
  })
})

describe('grep', () => {
  test('searches contents using rg json output', async () => {
    const result = (await grep({ pattern: 'alpha', path: 'search-target.ts' }, ctx)) as {
      matches: Array<{ path: string; line: number; text: string }>
      totalMatches: number
    }
    expect(result.totalMatches).toBe(2)
    expect(result.matches[0]?.path).toBe('search-target.ts')
  })

  test('respects abort signal', async () => {
    const aborted = new AbortController()
    aborted.abort()
    expect(grep({ pattern: 'test' }, { workspace, env: {}, signal: aborted.signal })).rejects.toThrow('Aborted')
  })
})

describe('bash', () => {
  test('executes shell commands', async () => {
    const result = (await bash({ command: 'echo hello' }, ctx)) as TruncationResult
    expect(result.content).toContain('hello')
  })

  test('throws on non-zero exit', async () => {
    expect(bash({ command: 'ls /nonexistent_dir_12345' }, ctx)).rejects.toThrow()
  })
})

describe('AGENT_CRUD_RISK_TAGS', () => {
  test('declares workspace tags for safe built-ins', () => {
    expect(AGENT_CRUD_RISK_TAGS.read_file).toContain(RISK_TAG.workspace)
    expect(AGENT_CRUD_RISK_TAGS.write_file).toContain(RISK_TAG.workspace)
    expect(AGENT_CRUD_RISK_TAGS.edit_file).toContain(RISK_TAG.workspace)
    expect(AGENT_CRUD_RISK_TAGS.list_files).toContain(RISK_TAG.workspace)
    expect(AGENT_CRUD_RISK_TAGS.grep).toContain(RISK_TAG.workspace)
  })

  test('keeps bash default-deny', () => {
    expect(AGENT_CRUD_RISK_TAGS.bash).toEqual([])
  })
})

describe('agentCrudHandlers', () => {
  test('exposes the built-in CRUD handlers', () => {
    expect(agentCrudHandlers.read_file).toBeDefined()
    expect(agentCrudHandlers.write_file).toBeDefined()
    expect(agentCrudHandlers.edit_file).toBeDefined()
    expect(agentCrudHandlers.list_files).toBeDefined()
    expect(agentCrudHandlers.grep).toBeDefined()
    expect(agentCrudHandlers.bash).toBeDefined()
  })
})
