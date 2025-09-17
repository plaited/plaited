/**
 * @internal
 * Utilities for browser-based story test execution.
 * Manages Playwright contexts and parallel test runs.
 */
import type { Browser, BrowserContext, ConsoleMessage } from 'playwright'
import type { StoryParams, RunningMap } from './workshop.types.js'

/**
 * @internal
 * Generates unique test run identifier.
 *
 * @param route - Story route path
 * @param colorScheme - Color scheme being tested
 * @returns Unique test ID
 */
export const useRunnerID = (route: string, colorScheme: string) => `${route}_${colorScheme}`

/**
 * @internal
 * Creates visitor for single color scheme testing.
 *
 * @param options - Visitor configuration
 * @param options.browser - Playwright browser
 * @param options.colorScheme - Test color scheme
 * @param options.serverURL - Story server URL
 * @param options.running - Active test map
 * @returns Story visitor function
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
 * Creates multi-color-scheme story visitor.
 * Entry point for parallel test execution.
 *
 * @param options - Visitor configuration
 * @param options.browser - Playwright browser
 * @param options.colorSchemeSupport - Enable dark mode testing
 * @param options.serverURL - Story server URL
 * @param options.running - Active test tracking
 * @returns Visitor for all color schemes
 *
 * @example
 * ```ts
 * const visit = useVisitStory({
 *   browser,
 *   colorSchemeSupport: true,
 *   serverURL,
 *   running
 * });
 * await visit({ route: '/button' });
 * // Tests in both light and dark modes
 * ```
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
