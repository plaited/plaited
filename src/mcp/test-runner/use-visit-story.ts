/**
 * @internal
 * Utilities for browser-based story test execution.
 * Manages Playwright contexts and parallel test runs.
 */
import type { Browser, BrowserContext, ConsoleMessage } from 'playwright'
import type { StoryParams, RunningMap } from './test-runner.types.js'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'

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
 * @param options.url - Story server URL
 * @param options.running - Active test map
 * @returns Story visitor function
 */
const visitStory = ({
  browser,
  colorScheme,
  url,
  running,
  server,
}: {
  browser: Browser
  colorScheme: 'light' | 'dark'
  url: URL
  running: RunningMap
  server?: Server
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
      if (msg.type() === 'error')
        server?.sendLoggingMessage({
          level: 'error',
          data: {
            error: `Test server visit story error message receeved`,
            detail: {
              message: msg,
            },
          },
        })
    })
    const { href } = new URL(params.route, url)
    try {
      await page.goto(href)
    } catch (error) {
      server?.sendLoggingMessage({
        level: 'error',
        data: {
          error: `Test server error occurred visiting story`,
          detail: error,
        },
      })
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
 * @param options.url - Story server URL
 * @param options.running - Active test tracking
 * @returns Visitor for all color schemes
 *
 * @example
 * ```ts
 * const visit = useVisitStory({
 *   browser,
 *   colorSchemeSupport: true,
 *   url,
 *   running
 * });
 * await visit({ route: '/button' });
 * // Tests in both light and dark modes
 * ```
 */
export const useVisitStory = ({
  browser,
  colorSchemeSupport,
  url,
  running,
  server,
}: {
  browser: Browser
  colorSchemeSupport?: boolean
  url: URL
  running: Map<string, StoryParams & { context: BrowserContext }>
  server?: Server
}) => {
  const visitations = [
    visitStory({ browser, colorScheme: 'light', url, running, server }),
    colorSchemeSupport && visitStory({ browser, colorScheme: 'dark', url, running, server }),
  ]

  return async (params: StoryParams) =>
    await Promise.all(visitations.flatMap(async (visit) => (visit ? await visit(params) : [])))
}
