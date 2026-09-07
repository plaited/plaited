import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { edit } from '../edit.ts'
import { tempDir } from './helpers.ts'

describe('edit tool', () => {
  test('replaces exact text and produces a valid patch (legacy single-edit shape)', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'hello world\nfoo bar\nbaz qux' })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await edit({
        cwd: process.cwd(),
        path: filePath,
        old_text: 'foo bar',
        new_text: 'FOO BAR',
      })

      expect(result.replacements).toBe(1)
      expect(result.patch).toContain('@@')
      expect(result.patch).toContain('-foo bar')
      expect(result.patch).toContain('+FOO BAR')
      expect(result.notice).toContain('Successfully replaced 1 block(s)')
      // Full content is no longer returned
      expect(result.content).toBeUndefined()

      const content = await Bun.file(filePath).text()
      expect(content).toBe('hello world\nFOO BAR\nbaz qux')
    } finally {
      await cleanup()
    }
  })

  test('reports error on missing old_text with isError', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'existing content' })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await edit({
        cwd: process.cwd(),
        path: filePath,
        old_text: 'does not exist',
        new_text: 'replacement',
      })

      expect(result.isError).toBe(true)
      expect(result.replacements).toBe(0)
      expect(result.message).toContain('Error')
    } finally {
      await cleanup()
    }
  })

  test('reports error on ambiguous match with isError', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'dup dup\nother' })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await edit({
        cwd: process.cwd(),
        path: filePath,
        old_text: 'dup',
        new_text: 'replaced',
      })

      expect(result.isError).toBe(true)
      expect(result.replacements).toBe(0)
      expect(result.message).toContain('2 occurrences')
    } finally {
      await cleanup()
    }
  })

  test('multi-edit: disjoint edits in one call', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'alpha\nbeta\ngamma\ndelta' })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await edit({
        cwd: process.cwd(),
        path: filePath,
        edits: [
          { old_text: 'alpha', new_text: 'ALPHA' },
          { old_text: 'gamma', new_text: 'GAMMA' },
        ],
      })

      expect(result.replacements).toBe(2)
      expect(result.notice).toContain('Successfully replaced 2 block(s)')
      expect(result.patch).toContain('-alpha')
      expect(result.patch).toContain('+ALPHA')
      expect(result.patch).toContain('-gamma')
      expect(result.patch).toContain('+GAMMA')

      const content = await Bun.file(filePath).text()
      expect(content).toBe('ALPHA\nbeta\nGAMMA\ndelta')
    } finally {
      await cleanup()
    }
  })

  test('multi-edit: overlapping edits are rejected', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'hello world\nfoo bar' })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await edit({
        cwd: process.cwd(),
        path: filePath,
        edits: [
          { old_text: 'hello world', new_text: 'HELLO WORLD' },
          { old_text: 'world\nfoo', new_text: 'WORLD\nFOO' },
        ],
      })

      expect(result.isError).toBe(true)
      expect(result.replacements).toBe(0)
      expect(result.message).toContain('overlap')
    } finally {
      await cleanup()
    }
  })

  test('multi-edit: non-unique old_text in one edit → error', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'dup\ndup\nother' })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await edit({
        cwd: process.cwd(),
        path: filePath,
        edits: [{ old_text: 'dup', new_text: 'replaced' }],
      })

      expect(result.isError).toBe(true)
      expect(result.message).toContain('2 occurrences')
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
      const result = await edit({
        cwd: process.cwd(),
        path: filePath,
        old_text: 'two',
        new_text: 'TWO-A\nTWO-B',
      })
      const after = await Bun.file(filePath).text()
      expect(applyUnifiedPatch(before, result.patch)).toBe(after)
    } finally {
      await cleanup()
    }
  })

  test('reconstruction: multi-edit with line-count changes — patch reproduces new content', async () => {
    const before = 'a\nX\nb\nX\nc\n'
    const { dir, cleanup } = await tempDir({ 'file.txt': before })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await edit({
        cwd: process.cwd(),
        path: filePath,
        edits: [
          { old_text: 'X\nb', new_text: 'Y1\nY2\nb' },
          { old_text: 'X\nc', new_text: 'Y1\nY2\nc' },
        ],
      })
      const after = await Bun.file(filePath).text()
      expect(applyUnifiedPatch(before, result.patch)).toBe(after)
    } finally {
      await cleanup()
    }
  })

  test('reconstruction: multi-edit same-size — patch reproduces new content', async () => {
    const before = 'apple\nbanana\napple\ncherry'
    const { dir, cleanup } = await tempDir({ 'file.txt': before })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await edit({
        cwd: process.cwd(),
        path: filePath,
        edits: [
          { old_text: 'apple\nbanana', new_text: 'orange\nbanana' },
          { old_text: 'apple\ncherry', new_text: 'orange\ncherry' },
        ],
      })
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
      const result = await edit({
        cwd: process.cwd(),
        path: filePath,
        old_text: 'apple',
        new_text: 'orange',
      })
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
      const result = await edit({
        cwd: process.cwd(),
        path: filePath,
        old_text: 'line2',
        new_text: 'modified',
      })

      expect(result.replacements).toBe(1)

      const bytes = await Bun.file(filePath).bytes()
      const raw = new TextDecoder().decode(bytes)
      expect(raw).toBe('line1\r\nmodified\r\nline3')
    } finally {
      await cleanup()
    }
  })

  test('full content is no longer returned in the output', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'hello world' })
    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await edit({
        cwd: process.cwd(),
        path: filePath,
        old_text: 'hello',
        new_text: 'goodbye',
      })
      expect(result.content).toBeUndefined()
      expect(result.notice).toBeDefined()
    } finally {
      await cleanup()
    }
  })
})

describe('edit tool — provisioned cwd', () => {
  test('relative path resolves against the composed cwd', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'old text' })
    try {
      const result = await edit({ cwd: dir, path: 'file.txt', old_text: 'old', new_text: 'new' })
      expect(result.replacements).toBe(1)
      expect(await Bun.file(path.join(dir, 'file.txt')).text()).toBe('new text')
    } finally {
      await cleanup()
    }
  })
})
