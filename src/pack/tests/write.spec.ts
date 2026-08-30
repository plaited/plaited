import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import writeTool, { type WriteInput } from '../write.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// write tool
// ================================================================

describe('write tool', () => {
  test('writes content to a file', async () => {
    const { dir, cleanup } = await tempDir({})

    const filePath = path.join(dir, 'output.txt')
    try {
      const result = await writeTool.run({ path: filePath, content: 'hello world' })
      expect(result.bytesWritten).toBe(11)

      const readBack = await Bun.file(filePath).text()
      expect(readBack).toBe('hello world')
    } finally {
      await cleanup()
    }
  })

  test('creates parent directories', async () => {
    const { dir, cleanup } = await tempDir({})

    const filePath = path.join(dir, 'a', 'b', 'nested.txt')
    try {
      await writeTool.run({ path: filePath, content: 'nested' })
      const readBack = await Bun.file(filePath).text()
      expect(readBack).toBe('nested')
    } finally {
      await cleanup()
    }
  })

  test('overwrites existing file', async () => {
    const { dir, cleanup } = await tempDir({ 'existing.txt': 'old content' })

    const filePath = path.join(dir, 'existing.txt')
    try {
      await writeTool.run({ path: filePath, content: 'new content' })
      const readBack = await Bun.file(filePath).text()
      expect(readBack).toBe('new content')
    } finally {
      await cleanup()
    }
  })
})

describe('write tool — provisioned cwd', () => {
  test('relative path writes into the composed cwd', async () => {
    const { dir, cleanup } = await tempDir({})
    try {
      const scoped = { ...writeTool, run: (input: WriteInput) => writeTool.run({ ...input, cwd: dir }) }
      await scoped.run({ path: 'out/nested.txt', content: 'scoped' })
      expect(await Bun.file(path.join(dir, 'out/nested.txt')).text()).toBe('scoped')
    } finally {
      await cleanup()
    }
  })
})
