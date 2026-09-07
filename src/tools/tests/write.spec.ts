import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import { write } from '../write.ts'
import { tempDir } from './helpers.ts'

describe('write tool', () => {
  test('writes content to a file', async () => {
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'output.txt')
    try {
      const result = await write({ cwd: process.cwd(), path: filePath, content: 'hello world' })
      expect(result.bytesWritten).toBe(11)
      expect(await Bun.file(filePath).text()).toBe('hello world')
    } finally {
      await cleanup()
    }
  })

  test('creates parent directories', async () => {
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'a', 'b', 'nested.txt')
    try {
      await write({ cwd: process.cwd(), path: filePath, content: 'nested' })
      expect(await Bun.file(filePath).text()).toBe('nested')
    } finally {
      await cleanup()
    }
  })

  test('overwrites existing file', async () => {
    const { dir, cleanup } = await tempDir({ 'existing.txt': 'old content' })
    const filePath = path.join(dir, 'existing.txt')
    try {
      await write({ cwd: process.cwd(), path: filePath, content: 'new content' })
      expect(await Bun.file(filePath).text()).toBe('new content')
    } finally {
      await cleanup()
    }
  })

  test('relative path resolves against the composed cwd', async () => {
    const { dir, cleanup } = await tempDir({})
    try {
      await write({ cwd: dir, path: 'rel/nested.txt', content: 'scoped' })
      expect(await Bun.file(path.join(dir, 'rel/nested.txt')).text()).toBe('scoped')
    } finally {
      await cleanup()
    }
  })

  test('bytesWritten is UTF-8 byte count, not code-unit count', async () => {
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'multibyte.txt')
    try {
      // '✓' is 3 UTF-8 bytes, 'x' is 1 byte — 5 chars = 11 bytes
      const content = '✓x✓x✓'
      const result = await write({ cwd: process.cwd(), path: filePath, content })
      expect(result.bytesWritten).toBe(11)
      expect(result.bytesWritten).not.toBe(content.length) // 5 code units
    } finally {
      await cleanup()
    }
  })
})
