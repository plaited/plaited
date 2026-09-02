import { describe, expect, test } from 'bun:test'
import * as path from 'node:path'
import writeTool from '../write.ts'
import { tempDir } from './helpers.ts'

// ================================================================
// write tool
// ================================================================

const runWrite = async (input: { path: string; content: string }, cwd?: string) => {
  const { output } = await writeTool.run({ ...input, cwd })
  return output as { bytesWritten: number }
}

describe('write tool', () => {
  test('writes content to a file', async () => {
    const { dir, cleanup } = await tempDir({})
    const filePath = path.join(dir, 'output.txt')
    try {
      const result = await runWrite({ path: filePath, content: 'hello world' })
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
      await runWrite({ path: filePath, content: 'nested' })
      expect(await Bun.file(filePath).text()).toBe('nested')
    } finally {
      await cleanup()
    }
  })

  test('overwrites existing file', async () => {
    const { dir, cleanup } = await tempDir({ 'existing.txt': 'old content' })
    const filePath = path.join(dir, 'existing.txt')
    try {
      await runWrite({ path: filePath, content: 'new content' })
      expect(await Bun.file(filePath).text()).toBe('new content')
    } finally {
      await cleanup()
    }
  })

  test('relative path resolves against the composed cwd', async () => {
    const { dir, cleanup } = await tempDir({})
    try {
      await runWrite({ path: 'rel/nested.txt', content: 'scoped' }, dir)
      expect(await Bun.file(path.join(dir, 'rel/nested.txt')).text()).toBe('scoped')
    } finally {
      await cleanup()
    }
  })
})
