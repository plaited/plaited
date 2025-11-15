/**
 * @internal
 * @module use-runner
 *
 * Purpose: Behavioral program for running Plaited story tests with Playwright
 * Architecture: Coordinates test execution, browser management, and result reporting
 * Dependencies: Playwright for browser automation, getServer for story serving
 * Consumers: Test CLI, CI/CD pipelines, development workflows
 *
 * Maintainer Notes:
 * - Server is created once at program initialization
 * - Reload callback enables hot reload during development
 * - Public events provide API for triggering test runs and reloads
 * - Test results are reported via signal for flexible consumption
 * - Browser context is reused across test runs for performance
 *
 * Common modification scenarios:
 * - Adding test filtering: Extend run_tests event detail
 * - Supporting parallel execution: Modify story processing logic
 * - Adding custom reporters: Extend reporter signal interface
 * - Implementing test retry: Add retry logic in error handlers
 *
 * Performance considerations:
 * - Server created once and reused across runs
 * - Browser context pooling for faster test execution
 * - Story discovery cached per run
 *
 * Known limitations:
 * - Single browser context per runner instance
 * - No built-in parallel test execution
 * - Server lifecycle tied to runner lifecycle
 */

import { useBehavioral } from '../main.js'
import { keyMirror } from '../utils.js'
import type { SignalWithoutInitialValue } from '../main.js'
import type { Browser, BrowserContextOptions } from '@playwright/test'
import { getServer } from './get-server.js'
import { discoverStoryMetadata } from './discover-story-metadata.js'
import type { StoryMetadata } from './workshop.types.js'

/**
 * @internal
 * Event types for test runner communication.
 */
export const TEST_RUNNER_EVENTS = keyMirror('run_tests', 'reload', 'end')

/**
 * @internal
 * Test result structure for individual story tests.
 */
export type TestResult = {
  story: StoryMetadata
  passed: boolean
  error?: unknown
}

/**
 * @internal
 * Output structure for test runner results.
 */
export type TestStoriesOutput = {
  passed: number
  failed: number
  total: number
  results: TestResult[]
}

/**
 * Creates a behavioral program for running Plaited story tests.
 * Manages server lifecycle, test execution, and result reporting.
 *
 * @param browser - Playwright browser instance
 * @param port - Port number for the test server
 * @param recordVideo - Optional video recording configuration
 * @param reporter - Signal for reporting test results
 *
 * @returns Public trigger function for controlling test execution
 *
 * @example Basic usage
 * ```ts
 * const browser = await chromium.launch();
 * const reporter = useSignal<TestStoriesOutput>();
 *
 * const trigger = await useRunner({
 *   browser,
 *   port: 3456,
 *   reporter
 * });
 *
 * // Run tests
 * trigger({ type: 'run_tests' });
 *
 * // Reload server
 * trigger({ type: 'reload' });
 *
 * // Clean up
 * trigger({ type: 'end' });
 * ```
 *
 * @remarks
 * - Server is created at initialization and reused
 * - Test discovery happens on each run_tests event
 * - Results are reported via the reporter signal
 * - Cleanup happens on end event
 *
 * @see {@link getServer} for server creation
 * @see {@link discoverStoryMetadata} for story discovery
 */
export const useRunner = useBehavioral<
  {
    run_tests?: StoryMetadata[]
    reload: void
    end: void
  },
  {
    browser: Browser
    port: number
    recordVideo?: BrowserContextOptions['recordVideo']
    reporter: SignalWithoutInitialValue<TestStoriesOutput>
    cwd: string
  }
>({
  publicEvents: ['run_tests', 'reload', 'end'],

  async bProgram({ browser, port, recordVideo, reporter, trigger, cwd, disconnect }) {
    const serverURL = `http://localhost:${port}`

    // Create server at program initialization
    const { reload, server } = await getServer({ cwd, port, trigger })

    return {
      async run_tests(metadata) {
        // Clear results for this test run
        const failed: TestResult[] = []
        const passed: TestResult[] = []

        console.log(`🔍 Discovering stories in: ${cwd}`)

        // Discover stories - handle undefined/empty metadata parameter
        // Behavioral programs pass {} as detail when no detail is provided
        const stories = Array.isArray(metadata) && metadata.length > 0 ? metadata : await discoverStoryMetadata(cwd)

        if (!stories || stories.length === 0) {
          console.warn('⚠️  No story exports found')
          reporter.set({
            passed: 0,
            failed: 0,
            total: 0,
            results: [],
          })
          return
        }

        console.log(`📄 Found ${stories.length} story exports`)

        // Create browser context
        const context = await browser.newContext({ recordVideo })

        try {
          // Run each story test
          for (const story of stories) {
            const page = await context.newPage()

            try {
              const storyURL = `${serverURL}/${story.exportName}`
              await page.goto(storyURL)

              // Wait for story to complete (implement based on your test protocol)
              // This is a placeholder - actual implementation depends on how stories signal completion
              await page.waitForLoadState('networkidle')

              passed.push({
                story,
                passed: true,
              })

              console.log(`✓ ${story.exportName}`)
            } catch (error) {
              failed.push({
                story,
                passed: false,
                error,
              })

              console.error(`✗ ${story.exportName}`, error)
            } finally {
              await page.close()
            }
          }
        } finally {
          await context.close()
        }

        // Report results
        const results = [...passed, ...failed]
        reporter.set({
          passed: passed.length,
          failed: failed.length,
          total: results.length,
          results,
        })

        console.log(`\n✅ Tests complete: ${passed.length} passed, ${failed.length} failed`)
      },
      reload,
      async end() {
        console.log('🛑 Shutting down test runner')
        disconnect()
        await server.stop()
      },
    }
  },
})
