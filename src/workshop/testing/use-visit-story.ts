import type { Browser, Page } from 'playwright'
import type { Trigger } from '../../behavioral/b-program.js'
import { type Signal } from '../../behavioral/use-signal.js'
import { isTypeOf } from '../../utils/is-type-of.js'
import { type A11yConfig } from './plaited-fixture.types.js'
import type { StoryParams } from '../workshop.types.js'
import { useHandleConsoleMessage } from './use-handle-console-message.js'

export const ACCESSIBILITY_VIOLATION = 'ACCESSIBILITY_VIOLATION'

const checkAccessibility = async (
  page: Page,
  config: null | {
    exclude?: string | string[]
    disableRules?: string | string[]
  },
) => {
  //@ts-ignore: expect error
  let instance = new AxeBuilder({ page }).include(PLAITED_FIXTURE)
  if (config?.exclude) {
    instance = instance.exclude(config.exclude)
  }
  if (config?.disableRules) {
    instance = instance.disableRules(config.disableRules)
  }
  const { violations } = await instance.analyze()
  return violations
}

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
    const handleConsoleMessage = useHandleConsoleMessage({ trigger, params, colorScheme, page })
    page.on('console', handleConsoleMessage)
    const { href } = new URL(params.route, serverURL)
    await page.goto(href, { waitUntil: 'domcontentloaded' })
    if (params?.a11y) {
      const violations = await checkAccessibility(
        page,
        isTypeOf<A11yConfig>(params.a11y, 'object') ? params.a11y : null,
      )
      violations.length &&
        trigger({
          type: ACCESSIBILITY_VIOLATION,
          detail: {
            colorScheme,
            page,
            ...params,
          },
        })
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
  const visiStories = [
    visitStory({ browser, colorScheme: 'light', trigger, serverURL }),
    colorSchemeSupportSignal.get() && visitStory({ browser, colorScheme: 'dark', trigger, serverURL }),
  ]
  return async (params: StoryParams) =>
    await Promise.all(visiStories.flatMap(async (visit) => (visit ? await visit(params) : [])))
}
