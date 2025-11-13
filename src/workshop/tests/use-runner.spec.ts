import { test, expect } from 'bun:test'
import { chromium } from '@playwright/test'
import { useRunner, type TestStoriesOutput } from '../use-runner.js'
import { useSignal, behavioral } from '../../main.js'
import { join } from 'node:path'

const fixturesDir = join(import.meta.dir, 'fixtures/stories')
const testPort = 3457

test('useRunner: discovers and executes stories from fixtures', async () => {
  const browser = await chromium.launch()
  const reporter = useSignal<TestStoriesOutput>()

  // Create promise to wait for reporter signal
  const resultsPromise = new Promise<TestStoriesOutput>((resolve) => {
    const { trigger: localTrigger, useFeedback } = behavioral()

    // Listen to the reporter signal
    reporter.listen('update', localTrigger)

    useFeedback({
      update(detail?: TestStoriesOutput) {
        if (detail) {
          resolve(detail)
        }
      }
    })
  })

  // Override process.cwd() for this test
  const originalCwd = process.cwd
  process.cwd = () => fixturesDir

  try {
    const trigger = await useRunner({ browser, port: testPort, reporter })

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

    // Clean up
    trigger({ type: 'end' })
  } finally {
    process.cwd = originalCwd
    await browser.close()
  }
})

test('useRunner: reports test results with correct structure', async () => {
  const browser = await chromium.launch()
  const reporter = useSignal<TestStoriesOutput>()

  const { trigger: localTrigger, useFeedback } = behavioral()

  const resultsPromise = new Promise<TestStoriesOutput>((resolve) => {
    reporter.listen('update', localTrigger)

    useFeedback({
      update(detail?: TestStoriesOutput) {
        if (detail) {
          resolve(detail)
        }
      }
    })
  })

  const originalCwd = process.cwd
  process.cwd = () => fixturesDir

  try {
    const trigger = await useRunner({ browser, port: testPort + 1, reporter })

    trigger({ type: 'run_tests' })

    const results = await resultsPromise

    // Verify we have 4 story exports from mixed-stories.stories.tsx
    expect(results.total).toBe(4)
    expect(results.passed).toBe(4)
    expect(results.failed).toBe(0)

    // Verify story names
    const storyNames = results.results.map(r => r.story.exportName).sort()
    expect(storyNames).toEqual(['basicStory', 'interactionStory', 'storyWithAllProps', 'storyWithParams'])

    trigger({ type: 'end' })
  } finally {
    process.cwd = originalCwd
    await browser.close()
  }
})

test('useRunner: reload event triggers server reload', async () => {
  const browser = await chromium.launch()
  const reporter = useSignal<TestStoriesOutput>()

  const originalCwd = process.cwd
  process.cwd = () => fixturesDir

  try {
    const trigger = await useRunner({ browser, port: testPort + 2, reporter })

    // Test that reload can be called without error
    expect(() => trigger({ type: 'reload' })).not.toThrow()

    trigger({ type: 'end' })
  } finally {
    process.cwd = originalCwd
    await browser.close()
  }
})

test('useRunner: end event completes successfully', async () => {
  const browser = await chromium.launch()
  const reporter = useSignal<TestStoriesOutput>()

  const originalCwd = process.cwd
  process.cwd = () => fixturesDir

  try {
    const trigger = await useRunner({ browser, port: testPort + 3, reporter })

    // Test that end can be called without error
    expect(() => trigger({ type: 'end' })).not.toThrow()
  } finally {
    process.cwd = originalCwd
    await browser.close()
  }
})

test('useRunner: supports video recording configuration', async () => {
  const browser = await chromium.launch()
  const reporter = useSignal<TestStoriesOutput>()

  const resultsPromise = new Promise<TestStoriesOutput>((resolve) => {
    const { trigger: localTrigger, useFeedback } = behavioral()

    reporter.listen('update', localTrigger)

    useFeedback({
      update(detail?: TestStoriesOutput) {
        if (detail) {
          resolve(detail)
        }
      }
    })
  })

  const originalCwd = process.cwd
  process.cwd = () => fixturesDir

  try {
    const trigger = await useRunner({
      browser,
      port: testPort + 4,
      reporter,
      recordVideo: {
        dir: join(import.meta.dir, 'test-videos'),
        size: { width: 1280, height: 720 },
      },
    })

    trigger({ type: 'run_tests' })

    const results = await resultsPromise

    // Verify tests ran successfully
    expect(results.total).toBeGreaterThan(0)

    trigger({ type: 'end' })
  } finally {
    process.cwd = originalCwd
    await browser.close()
  }
})

test('useRunner: multiple test runs work correctly', async () => {
  const browser = await chromium.launch()
  const reporter = useSignal<TestStoriesOutput>()

  let runCount = 0
  let resolveFirstRun: () => void
  let resolveSecondRun: () => void

  const firstRunPromise = new Promise<void>((resolve) => {
    resolveFirstRun = resolve
  })

  const secondRunPromise = new Promise<void>((resolve) => {
    resolveSecondRun = resolve
  })

  const { trigger: localTrigger, useFeedback } = behavioral()

  reporter.listen('update', localTrigger)

  useFeedback({
    update(detail?: TestStoriesOutput) {
      if (detail) {
        runCount++
        if (runCount === 1) {
          resolveFirstRun()
        } else if (runCount === 2) {
          resolveSecondRun()
        }
      }
    }
  })

  const originalCwd = process.cwd
  process.cwd = () => fixturesDir

  try {
    const trigger = await useRunner({ browser, port: testPort + 5, reporter })

    // Run tests first time
    trigger({ type: 'run_tests' })
    await firstRunPromise

    // Run tests second time
    trigger({ type: 'run_tests' })
    await secondRunPromise

    // Verify both runs completed
    expect(runCount).toBe(2)

    trigger({ type: 'end' })
  } finally {
    process.cwd = originalCwd
    await browser.close()
  }
})
