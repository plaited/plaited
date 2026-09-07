import { describe, expect, test } from 'bun:test'
import { find } from '../find.ts'
import { tempDir } from './helpers.ts'

describe('find tool', () => {
  test('finds files matching glob pattern (rg matches basenames recursively)', async () => {
    const { dir, cleanup } = await tempDir({
      'a.ts': '',
      'b.ts': '',
      'c.js': '',
      'sub/d.ts': '',
    })

    try {
      const result = await find({ cwd: process.cwd(), pattern: '*.ts', dir })
      // rg --files --glob '*.ts' matches basenames recursively
      expect(result.paths).toHaveLength(3)
      expect(result.paths).toContain('a.ts')
      expect(result.paths).toContain('b.ts')
      expect(result.paths).toContain('sub/d.ts')
      expect(result.truncated).toBe(false)
      expect(result.limit).toBe(1000)
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

  test('limit caps result count and appends a notice', async () => {
    const { dir, cleanup } = await tempDir({})
    for (let i = 0; i < 20; i++) {
      await Bun.write(`${dir}/file${i}.ts`, '')
    }

    try {
      const result = await find({ cwd: process.cwd(), pattern: '*.ts', dir, limit: 5 })
      expect(result.paths).toHaveLength(5)
      expect(result.truncated).toBe(true)
      expect(result.notice).toContain('5 results limit reached')
      expect(result.notice).toContain('limit=10')
      expect(result.limit).toBe(5)
    } finally {
      await cleanup()
    }
  })

  test('rg path respects .gitignore', async () => {
    // Seed a .gitignore that ignores node_modules, then create files in both
    const { dir, cleanup } = await tempDir({
      '.gitignore': 'node_modules/',
      'visible.ts': '',
      'node_modules/hidden.ts': '',
    })
    // Initialize a git repo so rg respects .gitignore
    await Bun.$`git init`.cwd(dir).quiet().nothrow()
    await Bun.$`git add -A`.cwd(dir).quiet().nothrow()

    try {
      const result = await find({ cwd: process.cwd(), pattern: '*.ts', dir })
      expect(result.paths).toContain('visible.ts')
      // node_modules/hidden.ts should be excluded by .gitignore
      expect(result.paths).not.toContain('node_modules/hidden.ts')
    } finally {
      await cleanup()
    }
  })

  test('results are sorted', async () => {
    const { dir, cleanup } = await tempDir({
      'zebra.ts': '',
      'apple.ts': '',
      'mango.ts': '',
    })

    try {
      const result = await find({ cwd: process.cwd(), pattern: '*.ts', dir })
      expect(result.paths).toEqual(['apple.ts', 'mango.ts', 'zebra.ts'])
    } finally {
      await cleanup()
    }
  })
})
