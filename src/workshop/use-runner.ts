/**
 * @internal
 * @module use-runner
 *
 * Purpose: Test runner for running Plaited story tests with Playwright
 * Architecture: Manages test execution, browser contexts, and result reporting
 * Dependencies: Playwright for browser automation, getServer for story serving
 * Consumers: Test CLI, CI/CD pipelines, development workflows
 *
 * Maintainer Notes:
 * - Server is created once at runner initialization
 * - Reload method enables hot reload during development
 * - Direct method invocation (run, reload, end) for controlling execution
 * - Test results are reported via callback for flexible consumption
 * - Browser contexts created per story for isolation
 *
 * Common modification scenarios:
 * - Adding test filtering: Extend RunTestsDetail type
 * - Supporting parallel execution: Modify story processing logic in run method
 * - Adding custom reporters: Extend reporter callback interface
 * - Implementing test retry: Add retry logic in error handlers
 *
 * Performance considerations:
 * - Server created once and reused across runs
 * - Stories execute in parallel via Promise.all
 * - Story discovery happens per run call
 *
 * Known limitations:
 * - Stories run in parallel but each gets its own browser context
 * - No built-in test retry mechanism
 * - Server lifecycle tied to runner lifecycle
 */

import type { Browser, BrowserContextOptions } from 'playwright'
import { FIXTURE_EVENTS } from '../testing/testing.constants.ts'
import { discoverStoryMetadata } from './collect-stories.ts'
import { getPaths } from './get-paths.ts'
import { getServer } from './get-server.ts'
import type { RunTestsDetail, StoryMetadata } from './workshop.types.ts'

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
 * Creates a test runner for running Plaited story tests.
 * Manages server lifecycle, test execution, and result reporting.
 *
 * @param browser - Playwright browser instance
 * @param port - Port number for the test server
 * @param recordVideo - Optional video recording configuration
 * @param reporter - Callback function to report test results
 * @param cwd - Working directory for story discovery
 *
 * @returns Object with methods for controlling test execution
 *
 * @remarks
 * - Server is created at initialization and reused
 * - Test discovery happens on each run call
 * - Results are reported via the reporter callback
 * - Cleanup happens on end call
 *
 * @see {@link getServer} for server creation
 * @see {@link discoverStoryMetadata} for story discovery
 */
export const useRunner = async ({
  browser,
  port,
  recordVideo,
  reporter,
  cwd,
}: {
  browser: Browser
  port: number
  recordVideo?: BrowserContextOptions['recordVideo']
  reporter: (results: TestStoriesOutput) => void
  cwd: string
}) => {
  // Create server at initialization
  const { reload, server } = await getServer({ cwd, port })

  return {
    async run(detail?: RunTestsDetail) {
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
        Array.isArray(metadata) && metadata.length > 0 ? metadata : await discoverStoryMetadata(cwd, '**/filtering/**')

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

      try {
        // Run all stories in parallel - let Playwright manage resources
        await Promise.all(
          stories.map(async (story) => {
            const context = await browser.newContext({
              recordVideo: videoConfig,
              colorScheme,
              baseURL: server.url.href,
            })
            const page = await context.newPage()
            await page.addInitScript(() => {
              window.__PLAITED_RUNNER__ = true
            })
            const { route } = getPaths({
              cwd,
              exportName: story.exportName,
              filePath: story.filePath,
            })

            await page.goto(route)
            await page.waitForLoadState('networkidle')

            const { type, detail } = await page.evaluate(() => {
              console.log(window.__PLAITED_RUNNER__, window.__PLAITED__)
              return window.__PLAITED__.reporter()
            })

            if (type === FIXTURE_EVENTS.test_pass) {
              console.log(`${story.exportName}:`, route)
              passed.push({
                story,
                passed: true,
              })
            } else {
              console.table({
                url: route,
                filePath: `.${story.filePath.replace(cwd, '')}`,
                exportName: story.exportName,
                colorScheme,
              })
              console.table({
                errorType: detail.errorType,
                error: detail.error,
              })
              failed.push({
                story,
                passed: false,
                error: detail,
              })
            }
            await context.close()
          }),
        )
      } catch (error) {
        console.error('Error during test execution:', error)
      }

      // Report results
      const results = [...passed, ...failed]
      reporter({
        passed: passed.length,
        failed: failed.length,
        total: results.length,
        results,
      })

      console.log('Pass:', passed.length)
      console.log('Fail:', failed.length)
    },
    reload,
    async end() {
      try {
        console.log('🛑 Shutting down test runner')
        await server.stop(true)
      } catch (error) {
        console.error('Error during cleanup:', error)
      }
    },
  }
}
