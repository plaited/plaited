import { describe, expect, test } from 'bun:test'
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
