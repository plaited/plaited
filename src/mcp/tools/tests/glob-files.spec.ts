import { describe, test, expect } from 'bun:test'
import { globFiles } from '../glob-files.js'

const fixturesPath = `${import.meta.dir}/fixtures`

describe('globFiles', () => {
  test('should find all .tsx files with wildcard pattern', async () => {
    const result = await globFiles({ cwd: fixturesPath, pattern: '*.tsx' })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((path) => path.endsWith('.tsx'))).toBe(true)
    expect(result.some((path) => path.includes('function-template.tsx'))).toBe(true)
    expect(result.some((path) => path.includes('behavioral-template.tsx'))).toBe(true)
  })

  test('should find specific file by exact name', async () => {
    const result = await globFiles({ cwd: fixturesPath, pattern: 'function-template.tsx' })

    expect(result).toHaveLength(1)
    expect(result[0]).toEndWith('function-template.tsx')
  })

  test('should find files with pattern matching', async () => {
    const result = await globFiles({ cwd: fixturesPath, pattern: '*-template.tsx' })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((path) => path.includes('-template.tsx'))).toBe(true)
    expect(result.some((path) => path.includes('function-template.tsx'))).toBe(true)
    expect(result.some((path) => path.includes('behavioral-template.tsx'))).toBe(true)
  })

  test('should return empty array for non-matching pattern', async () => {
    const result = await globFiles({ cwd: fixturesPath, pattern: '*.nonexistent' })

    expect(result).toEqual([])
  })

  test('should return absolute paths', async () => {
    const result = await globFiles({ cwd: fixturesPath, pattern: '*.tsx' })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((path) => path.startsWith('/'))).toBe(true)
    expect(result.every((path) => path.includes(fixturesPath))).toBe(true)
  })

  test('should handle recursive patterns', async () => {
    // Test with the parent directory to see if recursive works
    const parentPath = `${import.meta.dir}`
    const result = await globFiles({ cwd: parentPath, pattern: '**/*.tsx' })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((path) => path.endsWith('.tsx'))).toBe(true)
    // Should include files from the fixtures subdirectory
    expect(result.some((path) => path.includes('fixtures/'))).toBe(true)
  })

  test('should work with different working directories', async () => {
    // Test from the tests directory itself
    const testsDir = `${import.meta.dir}`
    const result = await globFiles({ cwd: testsDir, pattern: 'fixtures/*.tsx' })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((path) => path.includes('fixtures/'))).toBe(true)
    expect(result.every((path) => path.endsWith('.tsx'))).toBe(true)
  })

  test('should handle patterns with multiple extensions', async () => {
    const result = await globFiles({ cwd: fixturesPath, pattern: '*.{tsx,ts}' })

    expect(result.length).toBeGreaterThan(0)
    expect(result.every((path) => path.endsWith('.tsx') || path.endsWith('.ts'))).toBe(true)
  })

  test('should return consistent results on multiple calls', async () => {
    const result1 = await globFiles({ cwd: fixturesPath, pattern: '*.tsx' })
    const result2 = await globFiles({ cwd: fixturesPath, pattern: '*.tsx' })

    expect(result1).toEqual(result2)
  })
})
