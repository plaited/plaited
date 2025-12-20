import { expect, test } from 'bun:test'
import { join } from 'node:path'
import type { TestResult } from '../use-runner.ts'
import { useRunner } from '../use-runner.ts'

const cwd = join(import.meta.dir, 'fixtures')
const fixturesDir = join(cwd, 'stories')

test(
  'useRunner: should execute stories and report results via callback',
  async () => {
    const { promise, resolve } = Promise.withResolvers<{
      passed: TestResult[]
      failed: TestResult[]
    }>()

    const trigger = await useRunner({
      port: 0, // Auto-assign port
      cwd,
      colorScheme: 'light',
      paths: [fixturesDir],
      reporter: resolve,
    })

    trigger({ type: 'run' })

    const { passed, failed } = await promise

    // Verify results structure
    expect(passed.length + failed.length).toBeGreaterThan(0)
    expect(passed.every((r) => r.passed === true)).toBe(true)
    expect(failed.every((r) => r.passed === false)).toBe(true)

    // Verify each result has required properties
    ;[...passed, ...failed].forEach((result) => {
      expect(result.story).toBeDefined()
      expect(result.story.exportName).toBeDefined()
      expect(result.story.filePath).toBeDefined()
      expect(result.story.route).toBeDefined()
      expect(result.story.entryPath).toBeDefined()
      expect(result.story.type).toMatch(/interaction|snapshot/)
      expect(typeof result.passed).toBe('boolean')
    })
  },
  { timeout: 30000 },
)

test(
  'useRunner: should discover stories from multiple paths',
  async () => {
    const { promise, resolve } = Promise.withResolvers<{
      passed: TestResult[]
      failed: TestResult[]
    }>()

    const trigger = await useRunner({
      port: 0,
      cwd,
      colorScheme: 'light',
      paths: [fixturesDir],
      reporter: resolve,
    })

    trigger({ type: 'run' })

    const { passed, failed } = await promise

    const allResults = [...passed, ...failed]

    // Should find stories in nested directories
    const nestedStories = allResults.filter((r) => r.story.filePath.includes('/nested/'))
    expect(nestedStories.length).toBeGreaterThan(0)

    // Verify nested story names
    const exportNames = allResults.map((r) => r.story.exportName)
    expect(exportNames).toContain('nestedSnapshot')
    expect(exportNames).toContain('nestedInteraction')
  },
  { timeout: 30000 },
)

test(
  'useRunner: should handle mixed story types (interaction and snapshot)',
  async () => {
    const { promise, resolve } = Promise.withResolvers<{
      passed: TestResult[]
      failed: TestResult[]
    }>()

    const trigger = await useRunner({
      port: 0,
      cwd,
      colorScheme: 'light',
      paths: [fixturesDir],
      reporter: resolve,
    })

    trigger({ type: 'run' })

    const { passed, failed } = await promise

    const allResults = [...passed, ...failed]

    // Verify we have both types
    const hasSnapshot = allResults.some((r) => r.story.type === 'snapshot')
    const hasInteraction = allResults.some((r) => r.story.type === 'interaction')
    expect(hasSnapshot).toBe(true)
    expect(hasInteraction).toBe(true)
  },
  { timeout: 30000 },
)

test(
  'useRunner: should report passed and failed tests separately',
  async () => {
    const { promise, resolve } = Promise.withResolvers<{
      passed: TestResult[]
      failed: TestResult[]
    }>()

    const disconnect = await useRunner({
      port: 0,
      cwd,
      colorScheme: 'light',
      paths: [fixturesDir],
      reporter: resolve,
    })

    disconnect({ type: 'run' })

    const { passed, failed } = await promise

    //Verify there are failed and passed results
    expect(passed.length).toBeGreaterThan(0)
    expect(failed.length).toBeGreaterThan(0)

    // Verify passed tests have passed=true
    passed.forEach((result) => {
      expect(result.passed).toBe(true)
      expect(result.error).toBeUndefined()
    })

    // Verify failed tests have passed=false and error
    failed.forEach((result) => {
      expect(result.passed).toBe(false)
      expect(result.error).toBeDefined()
    })
  },
  { timeout: 30000 },
)

test(
  'useRunner: should handle empty paths gracefully',
  async () => {
    const emptyDir = join(cwd, 'entry-routes') // Directory with no .stories.tsx

    const { promise, resolve } = Promise.withResolvers<{
      passed: TestResult[]
      failed: TestResult[]
    }>()

    const disconnect = await useRunner({
      port: 0,
      cwd: emptyDir,
      colorScheme: 'light',
      paths: [emptyDir],
      reporter: resolve,
    })

    disconnect({ type: 'run' })

    const { passed, failed } = await promise

    // Should have no results
    expect(passed.length).toBe(0)
    expect(failed.length).toBe(0)
  },
  { timeout: 30000 },
)

test(
  'useRunner: should include story metadata in results',
  async () => {
    const { promise, resolve } = Promise.withResolvers<{
      passed: TestResult[]
      failed: TestResult[]
    }>()

    const disconnect = await useRunner({
      port: 0,
      cwd,
      colorScheme: 'light',
      paths: [fixturesDir],
      reporter: resolve,
    })

    disconnect({ type: 'run' })

    const { passed, failed } = await promise

    const allResults = [...passed, ...failed]
    expect(allResults.length).toBeGreaterThan(0)

    // Verify metadata properties
    allResults.forEach((result) => {
      expect(result.story.route).toBeDefined()
      expect(result.story.route.startsWith('/')).toBe(true)
      expect(result.story.entryPath).toBeDefined()
      expect(result.story.entryPath.endsWith('.js')).toBe(true)
      expect(result.story.hasPlay !== undefined).toBe(true)
      expect(result.story.hasArgs !== undefined).toBe(true)
      expect(result.story.hasTemplate !== undefined).toBe(true)
      expect(result.story.hasParameters !== undefined).toBe(true)
      expect(result.story.timeout).toBeGreaterThan(0)
    })
  },
  { timeout: 30000 },
)
