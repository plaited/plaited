import type { Browser, ConsoleMessage, BrowserContext } from 'playwright'
import type { Trigger } from '../../behavioral/b-program.js'
import { type Signal } from '../../behavioral/use-signal.js'
import type { StoryParams } from '../workshop.types.js'
import { SnapshotMessageSchema } from './testing.schema.js'
import { TESTING_EVENTS } from './testing.constants.js'
import type { LogMessageDetail } from './testing.types.js'

// =============================================================================
// CONSOLE MESSAGE HANDLING
// =============================================================================

export const useHandleConsoleMessage = ({
  trigger,
  params,
  colorScheme,
  context,
}: {
  trigger: Trigger
  params: StoryParams
  colorScheme: 'light' | 'dark'
  context: BrowserContext
}) => {
  return async (msg: ConsoleMessage): Promise<void> => {
    // Check if the message type is 'dir'
    if (msg.type() === 'table') {
      // The arguments of the console message are JSHandles
      const args = msg.args()
      for (const arg of args) {
        // Retrieve the JSON representation of the object
        const snapshot = await arg.jsonValue()
        // Log the object, using JSON.stringify for a nice format
        const result = SnapshotMessageSchema.safeParse(snapshot)
        if (result.success) {
          trigger<LogMessageDetail>({
            type: TESTING_EVENTS.log_event,
            detail: {
              snapshot: result.data,
              colorScheme,
              context,
              ...params,
            },
          })
        }
      }
    }
  }
}

// =============================================================================
// STORY VISITATION
// =============================================================================

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
    visitStory({ browser, colorScheme: 'light', trigger, serverURL }),
    colorSchemeSupportSignal.get() && visitStory({ browser, colorScheme: 'dark', trigger, serverURL }),
  ]
  return async (params: StoryParams) =>
    await Promise.all(visitations.flatMap(async (visit) => (visit ? await visit(params) : [])))
}