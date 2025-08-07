/**
 * @internal
 * @module story-runner.utils
 *
 * Purpose: Utility functions for Plaited's story runner testing infrastructure
 * Architecture: Integrates with Playwright for browser automation and visual testing
 * Dependencies: Playwright for browser control, story-server for serving test stories
 * Consumers: story-runner main module, test execution pipeline
 *
 * Maintainer Notes:
 * - These utilities manage browser contexts for parallel test execution
 * - Each story can run in both light and dark color schemes simultaneously
 * - Browser contexts are isolated for test independence
 * - Video recording is supported for debugging test failures
 * - Console errors are captured and logged for troubleshooting
 *
 * Common modification scenarios:
 * - Adding new browser configurations: Modify context creation options
 * - Changing error handling: Update console message filtering
 * - Supporting more color schemes: Extend colorScheme type and visitStory logic
 * - Adding test metadata: Extend StoryParams type and running map
 *
 * Performance considerations:
 * - Browser contexts are expensive - reuse when possible
 * - Video recording impacts performance significantly
 * - Parallel execution improves throughput but increases memory usage
 * - Consider batching stories to reduce context creation overhead
 */
import type { Browser, BrowserContext, ConsoleMessage } from 'playwright'
import type { RunningMap } from './story-runner.types.js'
import type { StoryParams } from './workshop.types.js'

/**
 * @internal
 * Generates a unique identifier for a running story test.
 * Combines route and color scheme to ensure uniqueness in parallel execution.
 *
 * @param route - The story route path (e.g., '/components/button')
 * @param colorScheme - The color scheme being tested ('light' or 'dark')
 * @returns Unique string identifier for the test run
 *
 * Usage pattern:
 * - Used as key in RunningMap to track active test contexts
 * - Enables lookup of specific test runs for cleanup or inspection
 * - Prevents collision when same story runs in different color schemes
 */
export const useRunnerID = (route: string, colorScheme: string) => `${route}_${colorScheme}`

/**
 * @internal
 * Creates a test visitor function for a specific color scheme.
 * Handles browser context creation, page setup, and navigation for story tests.
 *
 * @param options Configuration for the story visitor
 * @param options.browser - Playwright browser instance
 * @param options.colorScheme - Color scheme to test ('light' or 'dark')
 * @param options.serverURL - Base URL of the story server
 * @param options.running - Map tracking active test contexts
 *
 * @returns Async function that visits a story with the configured settings
 *
 * Architecture flow:
 * 1. Create isolated browser context with color scheme preference
 * 2. Create new page and inject runner detection flag
 * 3. Register in running map for lifecycle management
 * 4. Attach console error listener for debugging
 * 5. Navigate to story URL and handle errors gracefully
 *
 * Key implementation details:
 * - window.__PLAITED_RUNNER__ flag allows stories to detect test environment
 * - Browser contexts provide isolation between tests
 * - Video recording is conditional based on params
 * - Console errors are forwarded to test runner console
 * - Navigation errors are logged but don't fail the test setup
 *
 * Error handling:
 * - Navigation failures are caught to allow test cleanup
 * - Console errors are captured for debugging
 * - Context creation failures will throw (intentional)
 */
const visitStory = ({
  browser,
  colorScheme,
  serverURL,
  running,
}: {
  browser: Browser
  colorScheme: 'light' | 'dark'
  serverURL: URL
  running: RunningMap
}) => {
  return async (params: StoryParams) => {
    const context = await browser.newContext({ recordVideo: params?.recordVideo, colorScheme })
    const page = await context.newPage()
    await page.addInitScript(() => {
      window.__PLAITED_RUNNER__ = true
    })
    running.set(useRunnerID(params.route, colorScheme), {
      ...params,
      context,
    })
    page.on('console', (msg: ConsoleMessage) => {
      if (msg.type() === 'error') console.error(msg)
    })
    const { href } = new URL(params.route, serverURL)
    try {
      await page.goto(href)
    } catch (error) {
      console.log(error)
    }
  }
}

/**
 * @internal
 * Creates a story visitor that supports multiple color schemes.
 * Primary entry point for executing story tests with visual regression support.
 *
 * @param options Configuration for multi-scheme story visitor
 * @param options.browser - Playwright browser instance for test execution
 * @param options.colorSchemeSupport - Whether to test dark mode (default: false)
 * @param options.serverURL - Base URL where stories are served
 * @param options.running - Map tracking all active test contexts
 *
 * @returns Async function that visits a story in all configured color schemes
 *
 * Design decisions:
 * - Always tests light mode as baseline
 * - Dark mode is optional to reduce test time for components without dark styles
 * - Parallel execution of color schemes for efficiency
 * - Graceful handling of disabled color schemes (returns empty array)
 *
 * Usage pattern:
 * ```ts
 * const visit = useVisitStory({ browser, colorSchemeSupport: true, serverURL, running });
 * await visit({ route: '/button', recordVideo: { dir: './videos' } });
 * // Story now running in both light and dark mode contexts
 * ```
 *
 * Performance notes:
 * - Promise.all ensures parallel execution of color schemes
 * - flatMap handles conditional dark mode elegantly
 * - Context creation is the main performance bottleneck
 *
 * Future considerations:
 * - Could support custom color schemes beyond light/dark
 * - Might add viewport size variations
 * - Could implement retry logic for flaky tests
 */
export const useVisitStory = ({
  browser,
  colorSchemeSupport,
  serverURL,
  running,
}: {
  browser: Browser
  colorSchemeSupport?: boolean
  serverURL: URL
  running: Map<string, StoryParams & { context: BrowserContext }>
}) => {
  const visitations = [
    visitStory({ browser, colorScheme: 'light', serverURL, running }),
    colorSchemeSupport && visitStory({ browser, colorScheme: 'dark', serverURL, running }),
  ]

  return async (params: StoryParams) =>
    await Promise.all(visitations.flatMap(async (visit) => (visit ? await visit(params) : [])))
}
