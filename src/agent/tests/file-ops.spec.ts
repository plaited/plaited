import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { editFile, readFile, writeFile } from '../file-ops.ts'

// ============================================================================
// Test Setup
// ============================================================================

const TEST_DIR = '/tmp/claude/file-ops-test'

beforeEach(async () => {
  // Create test directory
  await Bun.$`mkdir -p ${TEST_DIR}`.quiet()
})

afterEach(async () => {
  // Cleanup test directory
  await Bun.$`rm -rf ${TEST_DIR}`.quiet()
})

// ============================================================================
// readFile Tests
// ============================================================================

describe('readFile', () => {
  test('reads existing file', async () => {
    const testFile = join(TEST_DIR, 'read-test.txt')
    await Bun.write(testFile, 'Hello, World!')

    const result = await readFile({ path: testFile })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.content).toBe('Hello, World!')
      expect(result.path).toBe(testFile)
    }
  })

  test('returns error for non-existent file', async () => {
    const result = await readFile({ path: join(TEST_DIR, 'does-not-exist.txt') })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('File not found')
    }
  })

  test('reads specific line range', async () => {
    const testFile = join(TEST_DIR, 'lines-test.txt')
    await Bun.write(testFile, 'line1\nline2\nline3\nline4\nline5')

    const result = await readFile({ path: testFile, startLine: 2, endLine: 4 })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.content).toBe('line2\nline3\nline4')
      expect(result.lines).toEqual({ start: 2, end: 4, total: 5 })
    }
  })

  test('clamps line range to file bounds', async () => {
    const testFile = join(TEST_DIR, 'clamp-test.txt')
    await Bun.write(testFile, 'line1\nline2\nline3')

    const result = await readFile({ path: testFile, startLine: 1, endLine: 100 })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.content).toBe('line1\nline2\nline3')
      expect(result.lines).toEqual({ start: 1, end: 3, total: 3 })
    }
  })

  test('returns error when start line exceeds file length', async () => {
    const testFile = join(TEST_DIR, 'exceed-test.txt')
    await Bun.write(testFile, 'line1\nline2')

    const result = await readFile({ path: testFile, startLine: 100 })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain('exceeds file length')
    }
  })
})

// ============================================================================
// writeFile Tests
// ============================================================================

describe('writeFile', () => {
  test('writes content to new file', async () => {
    const testFile = join(TEST_DIR, 'write-test.txt')

    const result = await writeFile({ path: testFile, content: 'Test content' })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.bytesWritten).toBeGreaterThan(0)
    }

    const content = await Bun.file(testFile).text()
    expect(content).toBe('Test content')
  })

  test('overwrites existing file', async () => {
    const testFile = join(TEST_DIR, 'overwrite-test.txt')
    await Bun.write(testFile, 'Original content')

    const result = await writeFile({ path: testFile, content: 'New content' })

    expect(result.success).toBe(true)

    const content = await Bun.file(testFile).text()
    expect(content).toBe('New content')
  })

  test('creates parent directories when requested', async () => {
    const testFile = join(TEST_DIR, 'nested/deep/write-test.txt')

    const result = await writeFile({
      path: testFile,
      content: 'Nested content',
      createDirs: true,
    })

    expect(result.success).toBe(true)

    const content = await Bun.file(testFile).text()
    expect(content).toBe('Nested content')
  })
})

// ============================================================================
// editFile Tests
// ============================================================================

describe('editFile', () => {
  test('replaces first occurrence by default', async () => {
    const testFile = join(TEST_DIR, 'edit-test.txt')
    await Bun.write(testFile, 'foo bar foo baz')

    const result = await editFile({
      path: testFile,
      oldString: 'foo',
      newString: 'qux',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.replacements).toBe(1)
    }

    const content = await Bun.file(testFile).text()
    expect(content).toBe('qux bar foo baz')
  })

  test('replaces all occurrences when replaceAll is true', async () => {
    const testFile = join(TEST_DIR, 'edit-all-test.txt')
    await Bun.write(testFile, 'foo bar foo baz foo')

    const result = await editFile({
      path: testFile,
      oldString: 'foo',
      newString: 'qux',
      replaceAll: true,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.replacements).toBe(3)
    }

    const content = await Bun.file(testFile).text()
    expect(content).toBe('qux bar qux baz qux')
  })

  test('returns error when string not found', async () => {
    const testFile = join(TEST_DIR, 'not-found-test.txt')
    await Bun.write(testFile, 'hello world')

    const result = await editFile({
      path: testFile,
      oldString: 'xyz',
      newString: 'abc',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('String not found in file')
    }
  })

  test('returns error for non-existent file', async () => {
    const result = await editFile({
      path: join(TEST_DIR, 'does-not-exist.txt'),
      oldString: 'foo',
      newString: 'bar',
    })

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe('File not found')
    }
  })

  test('handles multiline replacements', async () => {
    const testFile = join(TEST_DIR, 'multiline-test.txt')
    await Bun.write(testFile, 'start\nold content\nmore old\nend')

    const result = await editFile({
      path: testFile,
      oldString: 'old content\nmore old',
      newString: 'new content',
    })

    expect(result.success).toBe(true)

    const content = await Bun.file(testFile).text()
    expect(content).toBe('start\nnew content\nend')
  })
})
