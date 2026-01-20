import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { join } from 'node:path'
import { glob, grep } from '../search.ts'

// ============================================================================
// Test Setup
// ============================================================================

const TEST_DIR = '/tmp/claude/search-test'

beforeEach(async () => {
  // Create test directory structure
  await Bun.$`mkdir -p ${TEST_DIR}/src/utils`.quiet()
  await Bun.$`mkdir -p ${TEST_DIR}/tests`.quiet()

  // Create test files
  await Bun.write(join(TEST_DIR, 'src/main.ts'), 'export const main = () => console.log("main")')
  await Bun.write(join(TEST_DIR, 'src/utils/helper.ts'), 'export const helper = () => "helper"')
  await Bun.write(join(TEST_DIR, 'tests/main.spec.ts'), 'test("main", () => expect(true).toBe(true))')
  await Bun.write(join(TEST_DIR, 'README.md'), '# Test Project\n\nThis is a test.')
})

afterEach(async () => {
  // Cleanup test directory
  await Bun.$`rm -rf ${TEST_DIR}`.quiet()
})

// ============================================================================
// glob Tests
// ============================================================================

describe('glob', () => {
  test('finds files matching pattern', async () => {
    const result = await glob({ pattern: '**/*.ts', cwd: TEST_DIR })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.files).toContain('src/main.ts')
      expect(result.files).toContain('src/utils/helper.ts')
      expect(result.files).toContain('tests/main.spec.ts')
      expect(result.count).toBe(3)
    }
  })

  test('respects ignore patterns', async () => {
    const result = await glob({
      pattern: '**/*.ts',
      cwd: TEST_DIR,
      ignore: ['tests/**'],
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.files).toContain('src/main.ts')
      expect(result.files).not.toContain('tests/main.spec.ts')
      expect(result.count).toBe(2)
    }
  })

  test('finds specific file types', async () => {
    const result = await glob({ pattern: '**/*.md', cwd: TEST_DIR })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.files).toContain('README.md')
      expect(result.count).toBe(1)
    }
  })

  test('returns empty array when no matches', async () => {
    const result = await glob({ pattern: '**/*.xyz', cwd: TEST_DIR })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.files).toHaveLength(0)
      expect(result.count).toBe(0)
    }
  })

  test('uses current directory by default', async () => {
    const result = await glob({ pattern: 'package.json' })

    expect(result.success).toBe(true)
    if (result.success) {
      // Should find package.json in workspace root
      expect(result.files).toContain('package.json')
    }
  })
})

// ============================================================================
// grep Tests
// ============================================================================

describe('grep', () => {
  test('finds pattern in files', async () => {
    const result = await grep({ pattern: 'export', path: TEST_DIR })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.count).toBeGreaterThan(0)
      expect(result.matches.some((m) => m.file.includes('main.ts'))).toBe(true)
    }
  })

  test('respects glob filter', async () => {
    const result = await grep({
      pattern: 'export',
      path: TEST_DIR,
      glob: '*.ts',
    })

    expect(result.success).toBe(true)
    if (result.success) {
      // All matches should be .ts files
      expect(result.matches.every((m) => m.file.endsWith('.ts'))).toBe(true)
    }
  })

  test('handles case-insensitive search', async () => {
    const result = await grep({
      pattern: 'TEST',
      path: TEST_DIR,
      ignoreCase: true,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      // Should find "test" in main.spec.ts and "Test" in README.md
      expect(result.count).toBeGreaterThan(0)
    }
  })

  test('respects maxResults limit per file', async () => {
    // Add a file with multiple matches
    await Bun.write(join(TEST_DIR, 'multi.ts'), 'export const a = 1\nexport const b = 2\nexport const c = 3')

    const result = await grep({
      pattern: 'export',
      path: join(TEST_DIR, 'multi.ts'),
      maxResults: 2,
    })

    expect(result.success).toBe(true)
    if (result.success) {
      // --max-count=2 limits to 2 matches per file
      expect(result.count).toBeLessThanOrEqual(2)
    }
  })

  test('returns empty when no matches', async () => {
    const result = await grep({ pattern: 'zzz_nonexistent_zzz', path: TEST_DIR })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.matches).toHaveLength(0)
      expect(result.count).toBe(0)
    }
  })

  test('includes line numbers in results', async () => {
    const result = await grep({ pattern: 'main', path: TEST_DIR })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.count).toBeGreaterThan(0)
      for (const match of result.matches) {
        expect(match.line).toBeGreaterThan(0)
        expect(match.file).toBeDefined()
        expect(match.content).toBeDefined()
      }
    }
  })
})
