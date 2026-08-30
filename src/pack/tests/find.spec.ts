import { describe, expect, test } from 'bun:test'
import type { FindInput } from '../find.ts'
import findTool from '../find.ts'
import { tempDir } from './helpers.ts'

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
      const result = await findTool.run({ glob: '*.ts', path: dir })
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
      const result = await findTool.run({ glob: '**/*.ts', path: dir })
      expect(result.paths.length).toBe(2)
      expect(result.paths).toContain('a.ts')
      expect(result.paths).toContain('sub/b.ts')
    } finally {
      await cleanup()
    }
  })
})

describe('find tool — provisioned cwd', () => {
  test('no path scans the composed cwd', async () => {
    const { dir, cleanup } = await tempDir({ 'a.ts': '', 'sub/b.ts': '' })
    try {
      const scoped = { ...findTool, run: (input: FindInput) => findTool.run({ ...input, cwd: dir }) }
      const result = await scoped.run({ glob: '**/*.ts' })
      expect(result.paths).toContain('a.ts')
      expect(result.paths).toContain('sub/b.ts')
    } finally {
      await cleanup()
    }
  })
})
