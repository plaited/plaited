import type { Browser } from 'playwright'
import type { Trigger } from '../../behavioral/b-program.js'
import { type Signal } from '../../behavioral/use-signal.js'
import type { StoryParams } from '../workshop.types.js'
import { useHandleConsoleMessage } from './use-handle-console-message.js'


const visitStory = ({
  browser,
  colorScheme,
  serverURL,
  trigger,
}: {
  browser: Browser
  colorScheme: 'light' | 'dark'
  trigger: Trigger
  serverURL: URL
}) => {
  return async (params: StoryParams) => {
    const context = await browser.newContext({ recordVideo: params?.recordVideo, colorScheme })
    const page = await context.newPage()
    const handleConsoleMessage = useHandleConsoleMessage({ trigger, params, colorScheme, context })
    page.on('console', handleConsoleMessage)
    const { href } = new URL(params.route, serverURL)
    try {
      await page.goto(href, { waitUntil: 'domcontentloaded' })
    } catch (error) {
      console.log(error)
    }
  }
}

export const useVisitStory = ({
  browser,
  colorSchemeSupportSignal,
  serverURL,
  trigger,
}: {
  browser: Browser
  colorSchemeSupportSignal: Signal<boolean>
  trigger: Trigger
  serverURL: URL
}) => {
  const visitations = [
    visitStory({ browser, colorScheme: 'light', trigger, serverURL, }),
    colorSchemeSupportSignal.get() && visitStory({ browser, colorScheme: 'dark', trigger, serverURL, }),
  ]
  return async (params: StoryParams) =>
    await Promise.all(visitations.flatMap(async (visit) => (visit ? await visit(params) : [])))
}
