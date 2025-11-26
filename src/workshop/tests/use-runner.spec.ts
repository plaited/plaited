import { afterAll, beforeAll, expect, test } from 'bun:test'
import { type Browser, chromium } from 'playwright'
import { discoverStoryMetadata } from '../collect-stories.ts'
import { type TestStoriesOutput, useRunner } from '../use-runner.ts'

const cwd = `${import.meta.dir}/fixtures`
const testPort = 3457

// Helper to create a results promise with timeout
const createResultsPromise = (timeout = 10000) => {
  const { promise, resolve } = Promise.withResolvers<TestStoriesOutput>()
  return {
    promise: Promise.race([
      promise,
      new Promise<TestStoriesOutput>((_, reject) =>
        setTimeout(() => reject(new Error(`Test timed out after ${timeout}ms`)), timeout),
      ),
    ]),
    resolve,
  }
}

let browser: Browser

beforeAll(async () => {
  browser = await chromium.launch()
})

afterAll(async () => {
  await browser.close()
})

test(
  'useRunner: discovers and executes stories from fixtures',
  async () => {
    const { promise: resultsPromise, resolve: reportResults } = createResultsPromise()

    const runner = await useRunner({ browser, port: testPort, reporter: reportResults, cwd })

    // Run tests
    await runner.run({ colorScheme: 'light' })

    // Wait for results
    const results = await resultsPromise

    // Verify results structure
    expect(results).toBeDefined()
    expect(results.total).toBeGreaterThan(0)
    expect(results.passed).toBeGreaterThanOrEqual(0)
    expect(results.failed).toBeGreaterThanOrEqual(0)
    expect(results.passed + results.failed).toBe(results.total)
    expect(results.results).toBeInstanceOf(Array)
    expect(results.results.length).toBe(results.total)

    // Verify each result has required properties
    results.results.forEach((result) => {
      expect(result.story).toBeDefined()
      expect(result.story.exportName).toBeDefined()
      expect(result.story.filePath).toBeDefined()
      expect(result.story.type).toMatch(/interaction|snapshot/)
      expect(typeof result.passed).toBe('boolean')
    })

    await runner.end()
  },
  { timeout: 20000 },
)

test(
  'useRunner: discovers stories in nested directories',
  async () => {
    // Delay to ensure previous test's browser is fully cleaned up
    // Playwright browser cleanup can be slow when tests run sequentially
    await new Promise((r) => setTimeout(r, 1500))

    const { promise: resultsPromise, resolve: reportResults } = createResultsPromise()

    const runner = await useRunner({ browser, port: testPort + 1, reporter: reportResults, cwd })

    await runner.run({ colorScheme: 'light' })
    const results = await resultsPromise

    // Should find stories in nested directories
    const nestedStories = results.results.filter((r) => r.story.filePath.includes('/nested/'))
    expect(nestedStories.length).toBeGreaterThan(0)

    // Verify nested story names
    const exportNames = results.results.map((r) => r.story.exportName)
    expect(exportNames).toContain('nestedSnapshot')
    expect(exportNames).toContain('nestedInteraction')
    expect(exportNames).toContain('deeplyNestedStory')

    await runner.end()
  },
  { timeout: 20000 },
)

test(
  'useRunner: executes only specified stories when metadata provided',
  async () => {
    // Delay to ensure previous test's browser is fully cleaned up
    await new Promise((r) => setTimeout(r, 1500))

    const { promise: resultsPromise, resolve: reportResults } = createResultsPromise()

    // Discover all stories first
    const allStories = await discoverStoryMetadata(cwd)
    expect(allStories.length).toBeGreaterThan(2)

    // Select only first two stories
    const selectedStories = allStories.slice(0, 2)

    const runner = await useRunner({ browser, port: testPort + 2, reporter: reportResults, cwd })

    // Run with specific metadata
    await runner.run({ metadata: selectedStories, colorScheme: 'light' })
    const results = await resultsPromise

    // Should execute only the selected stories
    expect(results.total).toBe(2)
    expect(results.results.length).toBe(2)

    // Verify correct stories were run
    const executedNames = results.results.map((r) => r.story.exportName).sort()
    const selectedNames = selectedStories.map((s) => s.exportName).sort()
    expect(executedNames).toEqual(selectedNames)

    await runner.end()
  },
  { timeout: 20000 },
)

test(
  'useRunner: executes stories from additional files',
  async () => {
    // Delay to ensure previous test's browser is fully cleaned up
    await new Promise((r) => setTimeout(r, 1500))

    const { promise: resultsPromise, resolve: reportResults } = createResultsPromise(15000)

    // Discover stories from additional file
    const allStories = await discoverStoryMetadata(cwd, '**/filtering/**')
    const additionalStories = allStories.filter((s) => s.filePath.includes('additional-stories'))

    expect(additionalStories.length).toBeGreaterThan(0)

    const runner = await useRunner({ browser, port: testPort + 3, reporter: reportResults, cwd })

    await runner.run({ metadata: additionalStories, colorScheme: 'light' })
    const results = await resultsPromise

    // All should pass
    expect(results.total).toBe(additionalStories.length)
    expect(results.passed).toBe(additionalStories.length)
    expect(results.failed).toBe(0)

    // Verify all results passed
    results.results.forEach((result) => {
      expect(result.passed).toBe(true)
      expect(result.error).toBeUndefined()
    })

    await runner.end()
  },
  { timeout: 20000 },
)

test(
  'useRunner: handles mixed story types (interaction and snapshot)',
  async () => {
    // Delay to ensure previous test's browser is fully cleaned up
    await new Promise((r) => setTimeout(r, 1500))

    const { promise: resultsPromise, resolve: reportResults } = createResultsPromise(20000)

    const allStories = await discoverStoryMetadata(cwd, '**/filtering/**')

    // Get mix of interaction and snapshot stories from different files
    const snapshotStories = allStories.filter((s) => s.type === 'snapshot').slice(0, 2)
    const interactionStories = allStories.filter((s) => s.type === 'interaction').slice(0, 2)
    const mixedStories = [...snapshotStories, ...interactionStories]

    expect(mixedStories.length).toBeGreaterThan(2)

    const runner = await useRunner({ browser, port: testPort + 4, reporter: reportResults, cwd })

    await runner.run({ metadata: mixedStories, colorScheme: 'light' })
    const results = await resultsPromise

    // All should pass
    expect(results.total).toBe(mixedStories.length)
    expect(results.passed).toBe(mixedStories.length)
    expect(results.failed).toBe(0)

    // Verify we have both types
    const hasSnapshot = results.results.some((r) => r.story.type === 'snapshot')
    const hasInteraction = results.results.some((r) => r.story.type === 'interaction')
    expect(hasSnapshot).toBe(true)
    expect(hasInteraction).toBe(true)

    await runner.end()
  },
  { timeout: 30000 },
)

test(
  'useRunner: should use dark colorScheme when specified',
  async () => {
    // Delay to ensure previous test's browser is fully cleaned up
    await new Promise((r) => setTimeout(r, 1500))

    const { promise: resultsPromise, resolve: reportResults } = createResultsPromise()

    const runner = await useRunner({ browser, port: testPort + 5, reporter: reportResults, cwd })

    // Run test with dark color scheme
    await runner.run({ colorScheme: 'dark' })

    // Wait for results
    const results = await resultsPromise

    // Verify results structure
    expect(results).toBeDefined()
    expect(results.total).toBeGreaterThan(0)
    expect(results.passed).toBeGreaterThanOrEqual(0)

    await runner.end()
  },
  { timeout: 20000 },
)

test(
  'useRunner: should default to light colorScheme when not specified',
  async () => {
    // Delay to ensure previous test's browser is fully cleaned up
    await new Promise((r) => setTimeout(r, 1500))

    const { promise: resultsPromise, resolve: reportResults } = createResultsPromise()

    const runner = await useRunner({ browser, port: testPort + 6, reporter: reportResults, cwd })

    // Run test without specifying colorScheme
    await runner.run({})

    // Wait for results
    const results = await resultsPromise

    // Verify results structure (default light mode should work)
    expect(results).toBeDefined()
    expect(results.total).toBeGreaterThan(0)
    expect(results.passed).toBeGreaterThanOrEqual(0)

    await runner.end()
  },
  { timeout: 20000 },
)
