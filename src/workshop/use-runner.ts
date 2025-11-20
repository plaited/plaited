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

import type { Browser, BrowserContextOptions } from 'playwright'
import { useBehavioral } from '../main.js'
import { keyMirror } from '../utils.js'
import { discoverStoryMetadata } from './collect-stories.js'
import { getServer } from './get-server.js'
import type { RunTestsDetail, StoryMetadata } from './workshop.types.js'

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
 * @param reporter - Callback function to report test results
 *
 * @returns Public trigger function for controlling test execution
 *
 * @remarks
 * - Server is created at initialization and reused
 * - Test discovery happens on each run_tests event
 * - Results are reported via the reporter callback
 * - Cleanup happens on end event
 *
 * @see {@link getServer} for server creation
 * @see {@link discoverStoryMetadata} for story discovery
 */
export const useRunner = useBehavioral<
  {
    run_tests?: RunTestsDetail
    reload: undefined
    end?: () => void
  },
  {
    browser: Browser
    port: number
    recordVideo?: BrowserContextOptions['recordVideo']
    reporter: (results: TestStoriesOutput) => void
    cwd: string
  }
>({
  publicEvents: ['run_tests', 'reload', 'end'],

  async bProgram({ browser, port, recordVideo, reporter, trigger, cwd, disconnect }) {
    // Create server at program initialization
    const { reload, server } = await getServer({ cwd, port, trigger })

    return {
      async run_tests(detail) {
        // Clear results for this test run
        const failed: TestResult[] = []
        const passed: TestResult[] = []

        // Extract metadata and colorScheme from detail, with defaults
        const metadata = detail?.metadata
        const colorScheme = detail?.colorScheme ?? 'light'

        console.log(`🔍 Discovering stories in: ${cwd}`)

        // Discover stories - handle undefined/empty metadata parameter
        // Behavioral programs pass {} as detail when no detail is provided
        const stories =
          Array.isArray(metadata) && metadata.length > 0
            ? metadata
            : await discoverStoryMetadata(cwd, '**/filtering/**')

        if (!stories || stories.length === 0) {
          console.warn('⚠️  No story exports found')
          reporter({
            passed: 0,
            failed: 0,
            total: 0,
            results: [],
          })
          return
        }

        console.log(`📄 Found ${stories.length} story exports`)

        // Create browser context with colorScheme
        // Modify recordVideo directory to include colorScheme subdirectory
        const videoConfig = recordVideo
          ? {
              ...recordVideo,
              dir: `${recordVideo.dir}/${colorScheme}`,
            }
          : undefined

        const context = await browser.newContext({
          recordVideo: videoConfig,
          colorScheme,
        })

        try {
          // Run all stories in parallel - let Playwright manage resources
          const results = await Promise.all(
            stories.map(async (story) => {
              const page = await context.newPage()
              try {
                const storyURL = `${server.url.href}/${story.exportName}`
                await page.goto(storyURL)
                await page.waitForLoadState('networkidle')

                console.log(`✓ ${story.exportName}`)
                return {
                  story,
                  passed: true as const,
                }
              } catch (error) {
                console.error(`✗ ${story.exportName}`, error)
                return {
                  story,
                  passed: false as const,
                  error,
                }
              } finally {
                await page.close()
              }
            }),
          )

          // Aggregate results
          for (const result of results) {
            if (result.passed) {
              passed.push(result)
            } else {
              failed.push(result)
            }
          }
        } finally {
          await context.close()
        }

        // Report results
        const results = [...passed, ...failed]
        reporter({
          passed: passed.length,
          failed: failed.length,
          total: results.length,
          results,
        })

        console.log(`\n✅ Tests complete: ${passed.length} passed, ${failed.length} failed`)
      },
      reload,
      async end(resolve) {
        try {
          console.log('🛑 Shutting down test runner')
          await server.stop(true)
          disconnect()
        } catch (error) {
          console.error('Error during cleanup:', error)
        } finally {
          // Resolve the promise to signal cleanup is complete
          resolve?.()
        }
      },
    }
  },
})
