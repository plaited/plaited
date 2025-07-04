import type { Browser, BrowserContext, ConsoleMessage } from 'playwright'
import type { RunningMap } from './story-runner.types.js'
import type { StoryParams } from '../story-server/story-server.types.js'

export const useRunnerID = (route: string, colorScheme: string) => `${route}_${colorScheme}`

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
