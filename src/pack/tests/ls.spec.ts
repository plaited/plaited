import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import type { LsInput } from '../ls.ts'
import lsTool from '../ls.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// ls tool
// ================================================================

describe('ls tool', () => {
  test('lists directory entries with types', async () => {
    const { dir, cleanup } = await tempDir({})
    await Bun.write(path.join(dir, 'file.txt'), 'content')
    await Bun.$`mkdir -p ${path.join(dir, 'subdir')}`.quiet().nothrow()

    try {
      const result = await lsTool.run({ path: dir })
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
})

describe('ls tool — provisioned cwd', () => {
  test('relative path resolves against the composed cwd', async () => {
    const { dir, cleanup } = await tempDir({})
    await Bun.write(path.join(dir, 'sub', 'keep.txt'), 'x')
    try {
      const scoped = { ...lsTool, run: (input: LsInput) => lsTool.run({ ...input, cwd: dir }) }
      const result = await scoped.run({ path: 'sub' })
      expect(result.entries.map((e) => e.name)).toContain('keep.txt')
    } finally {
      await cleanup()
    }
  })
})
