import { type Trigger } from '../../behavioral/b-program.js'
import { chromium } from 'playwright'
import type { TestParams } from '../workshop.types.js'
import { useVisitStory } from './use-visit-story.js'

export const runTests = async ({
  tests,
  trigger,
  serverURL,
  testDarkColorScheme = false,
}: {
  tests: TestParams[]
  trigger: Trigger
  serverURL: URL
  testDarkColorScheme: boolean
}) => {
  try {
    const browser = await chromium.launch()
    const visit = useVisitStory({ browser, testDarkColorScheme, trigger, serverURL })
    await Promise.all(tests.map(visit))
    return browser
  } catch (e) {
    console.error(e)
  }
}
