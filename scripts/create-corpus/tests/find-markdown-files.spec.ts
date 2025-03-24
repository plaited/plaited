import { expect, test, describe, beforeAll, afterAll } from 'bun:test'
import { findMarkdownFiles } from '../find-markdown-files.js'
import { mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'

describe('findMarkdownFiles', () => {
  const testDir = `${import.meta.dir}/stub-markdown`
  const emptyDir = `${import.meta.dir}/stub-empty`
  // Setup test directory and files before tests
  beforeAll(async () => {
    await mkdir(testDir, { recursive: true })
    await writeFile(join(testDir, 'test1.md'), 'test')
    await writeFile(join(testDir, 'test2.markdown'), 'test')
    await mkdir(join(testDir, 'nested'), { recursive: true })
    await writeFile(join(testDir, 'nested', 'test3.md'), 'test')
  })

  // Cleanup after tests
  afterAll(async () => {
    await rm(testDir, { recursive: true })
  })

  test('finds all markdown files in directory', async () => {
    const files = await findMarkdownFiles(testDir)

    expect(files).toHaveLength(3)
    expect(files).toContain('test1.md')
    expect(files).toContain('test2.markdown')
    expect(files).toContain('nested/test3.md')
  })

  test('returns empty array for directory with no markdown files', async () => {
    await mkdir(emptyDir, { recursive: true })

    const files = await findMarkdownFiles(emptyDir)

    expect(files).toHaveLength(0)

    await rm(emptyDir, { recursive: true })
  })
})
