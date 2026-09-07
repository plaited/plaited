import { describe, expect, test } from 'bun:test'
import { grep } from '../grep.ts'
import { tempDir } from './helpers.ts'

describe('grep tool', () => {
  test('finds matching lines in files', async () => {
    const { dir, cleanup } = await tempDir({
      'file1.txt': 'hello world\nfoo bar\nhello again',
    })

    try {
      const result = await grep({ cwd: process.cwd(), pattern: 'hello', dir })
      expect(result.matches.length).toBeGreaterThanOrEqual(1)
      const match = result.matches.find((m) => m.line === 1)
      expect(match).toBeDefined()
      expect(match!.text).toContain('hello')
    } finally {
      await cleanup()
    }
  })

  test('no matches returns empty array with info message', async () => {
    const { dir, cleanup } = await tempDir({ 'file.txt': 'hello world' })
    try {
      const result = await grep({ cwd: process.cwd(), pattern: 'zzz_nonexistent', dir })
      expect(result.matches).toHaveLength(0)
      expect(result.message).toContain('no matches')
      expect(result.isError).toBeUndefined()
    } finally {
      await cleanup()
    }
  })
})
