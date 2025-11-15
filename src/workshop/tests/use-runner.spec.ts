import { test, expect, beforeAll, afterAll } from 'bun:test'
import { chromium, type Browser } from 'playwright'
import { useRunner, type TestStoriesOutput } from '../use-runner.js'
import { useSignal, type Trigger } from '../../main.js'
import { discoverStoryMetadata } from '../collect-stories.js'

const cwd = `${import.meta.dir}/fixtures`
const testPort = 3457

// Helper to create a results promise with timeout
const createResultsPromise = (reporter: ReturnType<typeof useSignal<TestStoriesOutput>>, timeout = 10000) => {
  return Promise.race([
    new Promise<TestStoriesOutput>((resolve) => {
      const spy: Trigger = ({ detail }) => resolve(detail)
      reporter.listen('_', spy)
    }),
    new Promise<TestStoriesOutput>((_, reject) =>
      setTimeout(() => reject(new Error(`Test timed out after ${timeout}ms`)), timeout),
    ),
  ])
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
    const reporter = useSignal<TestStoriesOutput>()

    const trigger = await useRunner({ browser, port: testPort, reporter, cwd })
    const resultsPromise = createResultsPromise(reporter)

    // Trigger test run
    trigger({ type: 'run_tests' })

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
    const { promise, resolve } = Promise.withResolvers<void>()
    trigger({ type: 'end', detail: resolve })
    await promise
  },
  { timeout: 20000 },
)

test(
  'useRunner: discovers stories in nested directories',
  async () => {
    // Delay to ensure previous test's browser is fully cleaned up
    // Playwright browser cleanup can be slow when tests run sequentially
    await new Promise((r) => setTimeout(r, 1500))

    const reporter = useSignal<TestStoriesOutput>()

    const trigger = await useRunner({ browser, port: testPort + 1, reporter, cwd })
    const resultsPromise = createResultsPromise(reporter)

    trigger({ type: 'run_tests' })
    const results = await resultsPromise

    // Should find stories in nested directories
    const nestedStories = results.results.filter((r) => r.story.filePath.includes('/nested/'))
    expect(nestedStories.length).toBeGreaterThan(0)

    // Verify nested story names
    const exportNames = results.results.map((r) => r.story.exportName)
    expect(exportNames).toContain('nestedSnapshot')
    expect(exportNames).toContain('nestedInteraction')
    expect(exportNames).toContain('deeplyNestedStory')

    const { promise, resolve } = Promise.withResolvers<void>()
    trigger({ type: 'end', detail: resolve })
    await promise
  },
  { timeout: 20000 },
)

test(
  'useRunner: executes only specified stories when metadata provided',
  async () => {
    // Delay to ensure previous test's browser is fully cleaned up
    await new Promise((r) => setTimeout(r, 1500))

    const reporter = useSignal<TestStoriesOutput>()

    // Discover all stories first
    const allStories = await discoverStoryMetadata(cwd)
    expect(allStories.length).toBeGreaterThan(2)

    // Select only first two stories
    const selectedStories = allStories.slice(0, 2)

    const trigger = await useRunner({ browser, port: testPort + 2, reporter, cwd })
    const resultsPromise = createResultsPromise(reporter)

    // Run with specific metadata
    trigger({ type: 'run_tests', detail: selectedStories })
    const results = await resultsPromise

    // Should execute only the selected stories
    expect(results.total).toBe(2)
    expect(results.results.length).toBe(2)

    // Verify correct stories were run
    const executedNames = results.results.map((r) => r.story.exportName).sort()
    const selectedNames = selectedStories.map((s) => s.exportName).sort()
    expect(executedNames).toEqual(selectedNames)

    const { promise, resolve } = Promise.withResolvers<void>()
    trigger({ type: 'end', detail: resolve })
    await promise
  },
  { timeout: 20000 },
)

test(
  'useRunner: executes stories from additional files',
  async () => {
    // Delay to ensure previous test's browser is fully cleaned up
    await new Promise((r) => setTimeout(r, 1500))

    const reporter = useSignal<TestStoriesOutput>()

    // Discover stories from additional file
    const allStories = await discoverStoryMetadata(cwd)
    const additionalStories = allStories.filter((s) => s.filePath.includes('additional-stories'))

    expect(additionalStories.length).toBeGreaterThan(0)

    const trigger = await useRunner({ browser, port: testPort + 3, reporter, cwd })
    const resultsPromise = createResultsPromise(reporter, 15000)

    trigger({ type: 'run_tests', detail: additionalStories })
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

    const { promise, resolve } = Promise.withResolvers<void>()
    trigger({ type: 'end', detail: resolve })
    await promise
  },
  { timeout: 20000 },
)

test(
  'useRunner: handles mixed story types (interaction and snapshot)',
  async () => {
    // Delay to ensure previous test's browser is fully cleaned up
    await new Promise((r) => setTimeout(r, 1500))

    const reporter = useSignal<TestStoriesOutput>()

    const allStories = await discoverStoryMetadata(cwd)

    // Get mix of interaction and snapshot stories from different files
    const snapshotStories = allStories.filter((s) => s.type === 'snapshot').slice(0, 2)
    const interactionStories = allStories.filter((s) => s.type === 'interaction').slice(0, 2)
    const mixedStories = [...snapshotStories, ...interactionStories]

    expect(mixedStories.length).toBeGreaterThan(2)

    const trigger = await useRunner({ browser, port: testPort + 4, reporter, cwd })
    const resultsPromise = createResultsPromise(reporter, 20000)

    trigger({ type: 'run_tests', detail: mixedStories })
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

    const { promise, resolve } = Promise.withResolvers<void>()
    trigger({ type: 'end', detail: resolve })
    await promise
  },
  { timeout: 30000 },
)
