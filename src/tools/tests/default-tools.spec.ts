import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { registerKernel } from '../../agent/kernel.ts'
import type { KnownStreamEvent, OpenResponsesRequest } from '../../agent/open-responses.schemas.ts'
import { provisionDefaults } from '../../agent/provision-defaults.ts'
import { useResponse } from '../../agent/use-response.ts'
import type { Trace } from '../../main/behavioral.schemas.ts'
import { behavioral } from '../../main/behavioral.ts'
import type { AddHandler, AddThread, Trigger } from '../../main/behavioral.types.ts'
import bashTool from '../bash.ts'
import editTool from '../edit.ts'
import findTool from '../find.ts'
import grepTool from '../grep.ts'
import lsTool from '../ls.ts'
import readTool from '../read.ts'
import writeTool from '../write.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// Helpers
// ================================================================

const tick = () => new Promise<void>((r) => setTimeout(r, 0))

/** Create a b-program and return hooks + trace collector. */
const createBP = () => {
  const bp = behavioral()
  const { useAddThread, useAddHandler, useTrigger, useTrace } = bp

  const addThread = useAddThread() as AddThread
  const addHandler = useAddHandler() as AddHandler
  const trigger = useTrigger() as Trigger
  const selected: string[] = []

  useTrace((msg: Trace) => {
    if (msg.kind === 'selection') {
      selected.push(msg.selected.type)
    }
  })

  return { addHandler, addThread, trigger, selected }
}

// ================================================================
// read tool
// ================================================================

describe('read tool', () => {
  test('reads a text file', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'hello\nworld\nthird line' })

    try {
      const { output } = await readTool.run({ path: path.join(dir, 'test.txt') })
      const result = output as { content: string; truncated: boolean; isError?: boolean }
      expect(result.truncated).toBe(false)
      expect(result.content).toBe('hello\nworld\nthird line')
    } finally {
      await cleanup()
    }
  })

  test('offset reads from a specific line (1-indexed)', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'line1\nline2\nline3\nline4' })

    try {
      const { output } = await readTool.run({ path: path.join(dir, 'test.txt'), offset: 2 })
      const result = output as { content: string; truncated: boolean }
      expect(result.content).toBe('line2\nline3\nline4')
      expect(result.truncated).toBe(false)
    } finally {
      await cleanup()
    }
  })

  test('offset + limit windows correctly', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'line1\nline2\nline3\nline4\nline5' })

    try {
      const { output } = await readTool.run({ path: path.join(dir, 'test.txt'), offset: 2, limit: 2 })
      const result = output as { content: string; truncated: boolean }
      expect(result.content).toBe('line2\nline3')
      expect(result.truncated).toBe(false)
    } finally {
      await cleanup()
    }
  })

  test('missing file returns error result with isError', async () => {
    const { output } = await readTool.run({ path: '/tmp/nonexistent-file-xyz-123' })
    const result = output as { isError?: boolean; content: string; truncated: boolean }
    expect(result.isError).toBe(true)
    expect(result.content).toContain('Error')
    expect(result.truncated).toBe(false)
  })

  test('offset beyond file length returns error with isError', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'hello' })

    try {
      const { output } = await readTool.run({ path: path.join(dir, 'test.txt'), offset: 10 })
      const result = output as { isError?: boolean; content: string }
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Error')
    } finally {
      await cleanup()
    }
  })
})

// ================================================================
// write tool
// ================================================================

describe('write tool', () => {
  test('writes content to a file', async () => {
    const { dir, cleanup } = await tempDir({})

    const filePath = path.join(dir, 'output.txt')
    try {
      const { output } = await writeTool.run({ path: filePath, content: 'hello world' })
      const result = output as { bytesWritten: number }
      expect(result.bytesWritten).toBe(11)

      const readBack = await Bun.file(filePath).text()
      expect(readBack).toBe('hello world')
    } finally {
      await cleanup()
    }
  })

  test('creates parent directories', async () => {
    const { dir, cleanup } = await tempDir({})

    const filePath = path.join(dir, 'a', 'b', 'nested.txt')
    try {
      await writeTool.run({ path: filePath, content: 'nested' })
      const readBack = await Bun.file(filePath).text()
      expect(readBack).toBe('nested')
    } finally {
      await cleanup()
    }
  })

  test('overwrites existing file', async () => {
    const { dir, cleanup } = await tempDir({ 'existing.txt': 'old content' })

    const filePath = path.join(dir, 'existing.txt')
    try {
      await writeTool.run({ path: filePath, content: 'new content' })
      const readBack = await Bun.file(filePath).text()
      expect(readBack).toBe('new content')
    } finally {
      await cleanup()
    }
  })
})

// ================================================================
// bash tool
// ================================================================

describe('bash tool', () => {
  test('executes a command and returns stdout', async () => {
    const { output } = await bashTool.run({ command: 'echo "hello"' })
    const result = output as { exitCode: number; stdout: string }
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe('hello')
  })

  test('returns stderr on error', async () => {
    const { output } = await bashTool.run({ command: 'echo "err" >&2; exit 1' })
    const result = output as { exitCode: number; stderr: string }
    expect(result.exitCode).toBe(1)
    expect(result.stderr.trim()).toBe('err')
  })

  test('timeout returns error stderr', async () => {
    const { output } = await bashTool.run({ command: 'sleep 10', timeout: 1 })
    const result = output as { exitCode: number; stderr: string }
    expect(result.exitCode).toBe(-1)
    expect(result.stderr).toContain('timed out')
  })
})

// ================================================================
// edit tool
// ================================================================

describe('edit tool', () => {
  test('replaces exact text and produces a valid patch', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'hello world\nfoo bar\nbaz qux' })

    const filePath = path.join(dir, 'file.txt')
    try {
      const { output } = await editTool.run({
        path: filePath,
        old_text: 'foo bar',
        new_text: 'FOO BAR',
      })
      const result = output as { replacements: number; patch: string; content?: string }

      expect(result.replacements).toBe(1)
      expect(result.patch).toContain('@@')
      expect(result.patch).toContain('-foo bar')
      expect(result.patch).toContain('+FOO BAR')

      // Verify the file was actually written
      const content = await Bun.file(filePath).text()
      expect(content).toBe('hello world\nFOO BAR\nbaz qux')

      // Verify content matches what was returned
      expect(result.content).toBe(content)
    } finally {
      await cleanup()
    }
  })

  test('reports error on missing old_text with isError', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'existing content' })

    const filePath = path.join(dir, 'file.txt')
    try {
      const { output } = await editTool.run({
        path: filePath,
        old_text: 'does not exist',
        new_text: 'replacement',
      })
      const result = output as { isError?: boolean; replacements: number; content?: string }

      expect(result.isError).toBe(true)
      expect(result.replacements).toBe(0)
      expect(result.content).toContain('Error')
    } finally {
      await cleanup()
    }
  })

  test('reports error on ambiguous match with isError', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'dup dup\nother' })

    const filePath = path.join(dir, 'file.txt')
    try {
      const { output } = await editTool.run({
        path: filePath,
        old_text: 'dup',
        new_text: 'replaced',
      })
      const result = output as { isError?: boolean; replacements: number; content?: string }

      expect(result.isError).toBe(true)
      expect(result.replacements).toBe(0)
      expect(result.content).toContain('2 occurrences')
    } finally {
      await cleanup()
    }
  })

  test('replace_all replaces multiple occurrences with multi-hunk patch', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'apple\nbanana\napple\ncherry' })

    const filePath = path.join(dir, 'file.txt')
    try {
      const { output } = await editTool.run({
        path: filePath,
        old_text: 'apple',
        new_text: 'orange',
        replace_all: true,
      })
      const result = output as { replacements: number; patch: string }

      expect(result.replacements).toBe(2)
      expect(result.patch).toContain('@@')

      const content = await Bun.file(filePath).text()
      expect(content).toBe('orange\nbanana\norange\ncherry')
    } finally {
      await cleanup()
    }
  })

  // Reconstruction verifier: apply a unified patch (as emitted by edit.ts) to
  // the old content. No patch library — hunk headers, '-', '+', ' ' lines only.
  const applyUnifiedPatch = (oldContent: string, patch: string): string => {
    const oldLines = oldContent.split('\n')
    const out: string[] = []
    let oldIdx = 0
    const hunkRe = /^@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@$/
    for (const line of patch.split('\n')) {
      const header = hunkRe.exec(line)
      if (header) {
        oldIdx = Math.max(oldIdx, Number(header[1]) - 1)
        continue
      }
      if (line.startsWith('-')) {
        oldIdx++
        continue
      }
      if (line.startsWith('+')) {
        out.push(line.slice(1))
        continue
      }
      out.push(oldLines[oldIdx++] ?? '')
    }
    while (oldIdx < oldLines.length) out.push(oldLines[oldIdx++]!)
    return out.join('\n')
  }

  test('reconstruction: line-count-changing replacement — patch reproduces new content', async () => {
    const before = 'one\ntwo\nthree\nfour\n'
    const { dir, cleanup } = await tempDir({ 'file.txt': before })
    const filePath = path.join(dir, 'file.txt')
    try {
      const { output } = await editTool.run({ path: filePath, old_text: 'two', new_text: 'TWO-A\nTWO-B' })
      const result = output as { patch: string }
      const after = await Bun.file(filePath).text()
      expect(applyUnifiedPatch(before, result.patch)).toBe(after)
    } finally {
      await cleanup()
    }
  })

  test('reconstruction: replace_all with line-count changes — patch reproduces new content', async () => {
    const before = 'a\nX\nb\nX\nc\n'
    const { dir, cleanup } = await tempDir({ 'file.txt': before })
    const filePath = path.join(dir, 'file.txt')
    try {
      const { output } = await editTool.run({
        path: filePath,
        old_text: 'X',
        new_text: 'Y1\nY2',
        replace_all: true,
      })
      const result = output as { patch: string }
      const after = await Bun.file(filePath).text()
      expect(applyUnifiedPatch(before, result.patch)).toBe(after)
    } finally {
      await cleanup()
    }
  })

  test('reconstruction: same-size replace_all — patch reproduces new content', async () => {
    const before = 'apple\nbanana\napple\ncherry'
    const { dir, cleanup } = await tempDir({ 'file.txt': before })
    const filePath = path.join(dir, 'file.txt')
    try {
      const { output } = await editTool.run({
        path: filePath,
        old_text: 'apple',
        new_text: 'orange',
        replace_all: true,
      })
      const result = output as { patch: string }
      const after = await Bun.file(filePath).text()
      expect(applyUnifiedPatch(before, result.patch)).toBe(after)
    } finally {
      await cleanup()
    }
  })

  test('reconstruction: mid-line replacement with prefix/suffix — patch reproduces new content', async () => {
    const before = 'apple pie\ncherry\ndate\n'
    const { dir, cleanup } = await tempDir({ 'file.txt': before })
    const filePath = path.join(dir, 'file.txt')
    try {
      const { output } = await editTool.run({ path: filePath, old_text: 'apple', new_text: 'orange' })
      const result = output as { patch: string }
      const after = await Bun.file(filePath).text()
      expect(applyUnifiedPatch(before, result.patch)).toBe(after)
    } finally {
      await cleanup()
    }
  })

  test('preserves CRLF line endings', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'line1\r\nline2\r\nline3' })

    const filePath = path.join(dir, 'file.txt')
    try {
      const { output } = await editTool.run({
        path: filePath,
        old_text: 'line2',
        new_text: 'modified',
      })
      const result = output as { replacements: number }

      expect(result.replacements).toBe(1)

      // Read raw bytes to verify CRLF preservation
      const bytes = await Bun.file(filePath).bytes()
      const raw = new TextDecoder().decode(bytes)
      expect(raw).toBe('line1\r\nmodified\r\nline3')
    } finally {
      await cleanup()
    }
  })
})

// ================================================================
// grep tool
// ================================================================

describe('grep tool', () => {
  test('finds matching lines in files', async () => {
    const { dir, cleanup } = await tempDir({
      'file1.txt': 'hello world\nfoo bar\nhello again',
    })

    try {
      const { output } = await grepTool.run({ pattern: 'hello', path: dir })
      const result = output as { matches: Array<{ line: number; text: string }> }
      expect(result.matches.length).toBeGreaterThanOrEqual(1)
      const match = result.matches.find((m) => m.line === 1)
      expect(match).toBeDefined()
      expect(match!.text).toContain('hello')
    } finally {
      await cleanup()
    }
  })
})

// ================================================================
// find tool
// ================================================================

describe('find tool', () => {
  test('finds files matching glob pattern', async () => {
    const { dir, cleanup } = await tempDir({
      'a.ts': '',
      'b.ts': '',
      'c.js': '',
      'sub/d.ts': '',
    })

    try {
      const { output } = await findTool.run({ glob: '*.ts', path: dir })
      const result = output as { paths: string[] }
      expect(result.paths.length).toBe(2)
      expect(result.paths).toContain('a.ts')
      expect(result.paths).toContain('b.ts')
    } finally {
      await cleanup()
    }
  })

  test('recursive glob with **', async () => {
    const { dir, cleanup } = await tempDir({
      'a.ts': '',
      'sub/b.ts': '',
      'sub/c.js': '',
    })

    try {
      const { output } = await findTool.run({ glob: '**/*.ts', path: dir })
      const result = output as { paths: string[] }
      expect(result.paths.length).toBe(2)
      expect(result.paths).toContain('a.ts')
      expect(result.paths).toContain('sub/b.ts')
    } finally {
      await cleanup()
    }
  })
})

// ================================================================
// ls tool
// ================================================================

describe('ls tool', () => {
  test('lists directory entries with types', async () => {
    const { dir, cleanup } = await tempDir({})
    await Bun.write(path.join(dir, 'file.txt'), 'content')
    await Bun.$`mkdir -p ${path.join(dir, 'subdir')}`.quiet().nothrow()

    try {
      const { output } = await lsTool.run({ path: dir })
      const result = output as { entries: Array<{ name: string; type: string }> }
      const names = result.entries.map((e) => e.name)
      expect(names).toContain('file.txt')
      expect(names).toContain('subdir')

      const fileEntry = result.entries.find((e) => e.name === 'file.txt')
      expect(fileEntry!.type).toBe('file')

      const dirEntry = result.entries.find((e) => e.name === 'subdir')
      expect(dirEntry!.type).toBe('directory')
    } finally {
      await cleanup()
    }
  })
})

// ================================================================
// Integration: provisionDefaults through b-program
// ================================================================

describe('provisionDefaults integration', () => {
  const textOnlyEvents: KnownStreamEvent[] = [
    {
      type: 'response.output_item.added',
      item: { id: 'msg_1', type: 'message', status: 'in_progress', role: 'assistant', content: [] },
    },
    {
      type: 'response.output_text.delta',
      item_id: 'msg_1',
      output_index: 0,
      content_index: 0,
      delta: 'Hello',
    },
    {
      type: 'response.output_item.done',
      output_index: 0,
      item: {
        id: 'msg_1',
        type: 'message',
        status: 'completed',
        role: 'assistant',
        content: [{ type: 'output_text', text: 'Hello' }],
      },
    },
    {
      type: 'response.completed',
      status: 'completed',
    },
  ]

  test('provisionDefaults wires all tools without error', () => {
    const hooks = createBP()
    expect(() => provisionDefaults(hooks)).not.toThrow()
  })

  test('read tool dispatched through b-program produces tool.result', async () => {
    const hooks = createBP()
    const descriptors = provisionDefaults(hooks)

    const readToolDesc = descriptors.find((d) => d.name === 'read')
    expect(readToolDesc).toBeDefined()

    const results: string[] = []
    hooks.addHandler('tool.result', ({ detail }) => {
      const { output } = (detail ?? {}) as { output: string }
      results.push(output)
    })

    const { dir, cleanup } = await tempDir({ 'test.txt': 'read me' })
    try {
      hooks.trigger({
        type: 'read',
        detail: {
          call_id: 'call_1',
          arguments: { path: path.join(dir, 'test.txt') },
        },
      })

      for (let i = 0; i < 6; i++) {
        await tick()
      }

      expect(hooks.selected).toContain('read')
      // Wait for async tool handler to finish
      for (let i = 0; i < 6; i++) {
        await tick()
      }
      expect(results.length).toBeGreaterThanOrEqual(1)
    } finally {
      await cleanup()
    }
  })

  test('edit tool dispatched through b-program applies changes', async () => {
    const hooks = createBP()
    provisionDefaults(hooks)

    const { dir, cleanup } = await tempDir({ 'edit.txt': 'old content' })
    const filePath = path.join(dir, 'edit.txt')

    try {
      hooks.trigger({
        type: 'edit',
        detail: {
          call_id: 'call_2',
          arguments: { path: filePath, old_text: 'old content', new_text: 'new content' },
        },
      })

      for (let i = 0; i < 10; i++) {
        await tick()
      }

      expect(hooks.selected).toContain('edit')

      // The file should be updated
      const content = await Bun.file(filePath).text()
      expect(content).toBe('new content')
    } finally {
      await cleanup()
    }
  })

  test('full dispatch flow: provision + registerKernel with tools', async () => {
    const callCount = { count: 0 }
    const adapter = useResponse({
      provider: 'test-provision',
      respond: async function* (_req: OpenResponsesRequest) {
        if (callCount.count === 0) {
          callCount.count++
          yield* textOnlyEvents
        }
      },
    })

    const hooks = createBP()
    const toolDescriptors = provisionDefaults(hooks)
    registerKernel(
      { addThread: hooks.addThread, addHandler: hooks.addHandler, trigger: hooks.trigger },
      adapter,
      toolDescriptors,
    )

    hooks.trigger({ type: 'user.prompt', detail: { prompt: 'Say hello' } })

    for (let i = 0; i < 12; i++) {
      await tick()
    }

    expect(hooks.selected).toContain('turn.end')
  })
})
