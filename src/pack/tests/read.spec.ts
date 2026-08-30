import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import readTool from '../read.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// read tool
// ================================================================

describe('read tool', () => {
  test('reads a text file', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'hello\nworld\nthird line' })

    try {
      const result = await readTool.run({ path: path.join(dir, 'test.txt') })
      expect(result.truncated).toBe(false)
      expect(result.content).toBe('hello\nworld\nthird line')
    } finally {
      await cleanup()
    }
  })

  test('offset reads from a specific line (1-indexed)', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'line1\nline2\nline3\nline4' })

    try {
      const result = await readTool.run({ path: path.join(dir, 'test.txt'), offset: 2 })
      expect(result.content).toBe('line2\nline3\nline4')
      expect(result.truncated).toBe(false)
    } finally {
      await cleanup()
    }
  })

  test('offset + limit windows correctly', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'line1\nline2\nline3\nline4\nline5' })

    try {
      const result = await readTool.run({ path: path.join(dir, 'test.txt'), offset: 2, limit: 2 })
      expect(result.content).toBe('line2\nline3')
      expect(result.truncated).toBe(false)
    } finally {
      await cleanup()
    }
  })

  test('missing file returns error result with isError', async () => {
    const result = await readTool.run({ path: '/tmp/nonexistent-file-xyz-123' })
    expect(result.isError).toBe(true)
    expect(result.content).toContain('Error')
    expect(result.truncated).toBe(false)
  })

  test('offset beyond file length returns error with isError', async () => {
    const { dir, cleanup } = await tempDir({ 'test.txt': 'hello' })

    try {
      const result = await readTool.run({ path: path.join(dir, 'test.txt'), offset: 10 })
      expect(result.isError).toBe(true)
      expect(result.content).toContain('Error')
    } finally {
      await cleanup()
    }
  })
})
