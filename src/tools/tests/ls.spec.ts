import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { ls } from '../ls.ts'
import { tempDir } from './helpers.ts'

describe('ls tool', () => {
  test('lists directory entries with types', async () => {
    const { dir, cleanup } = await tempDir({})
    await Bun.write(path.join(dir, 'file.txt'), 'content')
    await Bun.$`mkdir -p ${path.join(dir, 'subdir')}`.quiet().nothrow()

    try {
      const result = await ls({ cwd: process.cwd(), dir })
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

  test('entries are sorted case-insensitively', async () => {
    const { dir, cleanup } = await tempDir({})
    // Create entries in non-sorted order with mixed case
    await Bun.write(path.join(dir, 'Banana.txt'), '')
    await Bun.write(path.join(dir, 'apple.txt'), '')
    await Bun.write(path.join(dir, 'Cherry.txt'), '')
    await Bun.$`mkdir -p ${path.join(dir, 'BlueDir')}`.quiet().nothrow()

    try {
      const result = await ls({ cwd: process.cwd(), dir })
      const names = result.entries.map((e) => e.name)
      // Case-insensitive sort: apple, Banana, BlueDir, Cherry
      expect(names).toEqual(['apple.txt', 'Banana.txt', 'BlueDir', 'Cherry.txt'])
    } finally {
      await cleanup()
    }
  })

  test('limit caps entry count and appends a notice', async () => {
    const { dir, cleanup } = await tempDir({})
    for (let i = 0; i < 10; i++) {
      await Bun.write(path.join(dir, `file${i}.txt`), '')
    }

    try {
      const result = await ls({ cwd: process.cwd(), dir, limit: 5 })
      expect(result.entries).toHaveLength(5)
      expect(result.truncated).toBe(true)
      expect(result.notice).toContain('5 entries limit reached')
      expect(result.notice).toContain('limit=10')
      expect(result.limit).toBe(5)
    } finally {
      await cleanup()
    }
  })

  test('empty directory returns empty entries with no error', async () => {
    const { dir, cleanup } = await tempDir({})
    try {
      const result = await ls({ cwd: process.cwd(), dir })
      expect(result.entries).toHaveLength(0)
      expect(result.isError).toBeUndefined()
      expect(result.truncated).toBe(false)
    } finally {
      await cleanup()
    }
  })
})
