import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import editTool from '../edit.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// edit tool
// ================================================================

describe('edit tool', () => {
  test('replaces exact text and produces a valid patch', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'hello world\nfoo bar\nbaz qux' })

    const filePath = path.join(dir, 'file.txt')
    try {
      const result = await editTool.run({
        path: filePath,
        old_text: 'foo bar',
        new_text: 'FOO BAR',
      })

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
      const result = await editTool.run({
        path: filePath,
        old_text: 'does not exist',
        new_text: 'replacement',
      })

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
      const result = await editTool.run({
        path: filePath,
        old_text: 'dup',
        new_text: 'replaced',
      })

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
      const result = await editTool.run({
        path: filePath,
        old_text: 'apple',
        new_text: 'orange',
        replace_all: true,
      })

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
      const result = await editTool.run({ path: filePath, old_text: 'two', new_text: 'TWO-A\nTWO-B' })
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
      const result = await editTool.run({
        path: filePath,
        old_text: 'X',
        new_text: 'Y1\nY2',
        replace_all: true,
      })
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
      const result = await editTool.run({
        path: filePath,
        old_text: 'apple',
        new_text: 'orange',
        replace_all: true,
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
      const result = await editTool.run({ path: filePath, old_text: 'apple', new_text: 'orange' })
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
      const result = await editTool.run({
        path: filePath,
        old_text: 'line2',
        new_text: 'modified',
      })

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
