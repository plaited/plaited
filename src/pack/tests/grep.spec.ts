import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { join } from 'node:path'
import type { GrepInput } from '../grep.ts'
import grepTool from '../grep.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// grep tool
// ================================================================

describe('grep tool', () => {
  test('finds matching lines in files', async () => {
    const { dir, cleanup } = await tempDir({
      'file1.txt': 'hello world\nfoo bar\nhello again',
    })

    try {
      const result = await grepTool.run({ pattern: 'hello', path: dir })
      expect(result.matches.length).toBeGreaterThanOrEqual(1)
      const match = result.matches.find((m) => m.line === 1)
      expect(match).toBeDefined()
      expect(match!.text).toContain('hello')
    } finally {
      await cleanup()
    }
  })
})

describe('grep tool — provisioned cwd', () => {
  test('no path searches the composed cwd, not process cwd', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'needle-xyz-42 here' })
    try {
      const scoped = { ...grepTool, run: (input: GrepInput) => grepTool.run({ ...input, cwd: dir }) }
      const result = await scoped.run({ pattern: 'needle-xyz-42' })
      expect(result.matches.some((m) => path.resolve(m.path) === join(dir, 'file.txt'))).toBe(true)
      expect(
        result.matches.every((m) => m.path === 'file.txt' || path.resolve(dir, m.path).startsWith(dir + path.sep)),
      ).toBe(true)
    } finally {
      await cleanup()
    }
  })
})
