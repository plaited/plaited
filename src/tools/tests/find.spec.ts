import { describe, expect, test } from 'bun:test'
import { find } from '../find.ts'
import { tempDir } from './helpers.ts'

describe('find tool', () => {
  test('finds files matching glob pattern', async () => {
    const { dir, cleanup } = await tempDir({
      'a.ts': '',
      'b.ts': '',
      'c.js': '',
      'sub/d.ts': '',
    })

    try {
      const result = await find({ cwd: process.cwd(), pattern: '*.ts', dir })
      expect(result.paths).toHaveLength(2)
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
      const result = await find({ cwd: process.cwd(), pattern: '**/*.ts', dir })
      expect(result.paths).toHaveLength(2)
      expect(result.paths).toContain('a.ts')
      expect(result.paths).toContain('sub/b.ts')
    } finally {
      await cleanup()
    }
  })

  test('no matching pattern returns empty paths with info message', async () => {
    const { dir, cleanup } = await tempDir({ 'a.ts': '' })
    try {
      const result = await find({ cwd: process.cwd(), pattern: '*.js', dir })
      expect(result.paths).toHaveLength(0)
      expect(result.message).toContain('no files matched')
      expect(result.isError).toBeUndefined()
    } finally {
      await cleanup()
    }
  })
})
