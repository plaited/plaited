import { type Browser, type BrowserContextOptions } from 'playwright'
import { useBehavioral, type SignalWithoutInitialValue } from '../main.js'
import { type RunnerMessage } from '../testing.js'
import { TEST_RUNNER_EVENTS, __PLAITED_RUNNER__, __CLOSE_PLAITED_CONTEXT__ } from './test-stories.constants.js'
import { FIXTURE_EVENTS } from '../testing/testing.constants.js'
import { type StoryMetadata } from './workshop.types.js'
import { getStoryUrl } from './get-story-url.js'
import { type TestStoriesInput, type TestResult, type TestStoriesOutput } from './test-stories.types.js'

type FixtureEventDetail = {
  pathname: string
  filePath: string
  exportName: string
  colorScheme: ColorScheme
  detail: unknown
}

type RunID = `light:://${string}` | `dark:://${string}`

type RunningMap = Map<RunID, StoryMetadata>

type ColorScheme = 'light' | 'dark'

const useRunnerID = (colorScheme: ColorScheme, route: string): RunID => `${colorScheme}:://${route}`

export const testStories = useBehavioral<
  {
    [TEST_RUNNER_EVENTS.run_tests]: TestStoriesInput
    [TEST_RUNNER_EVENTS.on_runner_message]: RunnerMessage
    [TEST_RUNNER_EVENTS.test_end]: RunID
    [TEST_RUNNER_EVENTS.end]: void
    [FIXTURE_EVENTS.failed_assertion]: FixtureEventDetail
    [FIXTURE_EVENTS.missing_assertion_parameter]: FixtureEventDetail
    [FIXTURE_EVENTS.test_timeout]: FixtureEventDetail
    [FIXTURE_EVENTS.unknown_error]: FixtureEventDetail
    [FIXTURE_EVENTS.run_complete]: FixtureEventDetail
    [FIXTURE_EVENTS.accessibility_violation]: FixtureEventDetail
  },
  {
    serverURL: string
    browser: Browser
    recordVideo: BrowserContextOptions['recordVideo']
    reporter: SignalWithoutInitialValue<TestStoriesOutput>
  }
>({
  publicEvents: [TEST_RUNNER_EVENTS.run_tests, TEST_RUNNER_EVENTS.on_runner_message],
  async bProgram({ bSync, bThread, bThreads, trigger, serverURL, browser, recordVideo, reporter }) {
    const failed: TestResult[] = []
    const passed: TestResult[] = []

    const running: RunningMap = new Map()

    bThreads.set({
      onCountChange: bThread(
        [
          bSync({
            waitFor: ({ type }) => {
              const events = [
                FIXTURE_EVENTS.failed_assertion,
                FIXTURE_EVENTS.missing_assertion_parameter,
                FIXTURE_EVENTS.test_timeout,
                FIXTURE_EVENTS.unknown_error,
                FIXTURE_EVENTS.run_complete,
                FIXTURE_EVENTS.accessibility_violation,
              ]
              if (!events.includes(type as (typeof events)[number])) return false
              return running.size === 1
            },
          }),
          bSync({ request: { type: TEST_RUNNER_EVENTS.end } }),
        ],
        true,
      ),
    })

    const handleFailure = async ({ pathname, filePath, exportName, colorScheme, detail }: FixtureEventDetail) => {
      trigger({ type: TEST_RUNNER_EVENTS.test_end, detail: useRunnerID(colorScheme, pathname) })

      failed.push({
        detail,
        meta: {
          url: new URL(pathname, serverURL).href,
          filePath: `.${filePath}`,
          exportName,
          colorScheme,
        },
      })
    }

    const handleSuccess = async ({ pathname, colorScheme, detail, filePath, exportName }: FixtureEventDetail) => {
      trigger({ type: TEST_RUNNER_EVENTS.test_end, detail: useRunnerID(colorScheme, pathname) })

      passed.push({
        detail,
        meta: {
          url: new URL(pathname, serverURL).href,
          filePath: `.${filePath}`,
          exportName,
          colorScheme,
        },
      })
    }

    return {
      async [TEST_RUNNER_EVENTS.run_tests]({ storiesMetaData, colorSchemeSupport, hostName }) {
        for (const metadata of storiesMetaData) {
          const { filePath, exportName } = metadata
          const route = getStoryUrl({ filePath, exportName })
          running.set(useRunnerID('light', route), metadata)
          colorSchemeSupport && running.set(useRunnerID('dark', route), metadata)
        }
        await Promise.all(
          [...running].map(async ([id, { filePath, exportName }]) => {
            const route = getStoryUrl({ filePath, exportName })
            bThreads.set({
              [`on_${id}`]: bThread([
                bSync({
                  waitFor: id,
                }),
                bSync({
                  request: {
                    type: TEST_RUNNER_EVENTS.test_end,
                    detail: id,
                  },
                }),
              ]),
            })
            const colorScheme = id.match(/^(light|dark)::/)?.[1] as ColorScheme
            const context = await browser.newContext({ colorScheme, recordVideo })
            const page = await context.newPage()
            await page.addInitScript(() => {
              window[__PLAITED_RUNNER__] = true
            })
            await page.exposeFunction(__CLOSE_PLAITED_CONTEXT__, async () => {
              await context.close()
            })
            const { href } = new URL(route, hostName)
            await page.goto(href)
          }),
        )
      },
      [TEST_RUNNER_EVENTS.on_runner_message](detail) {
        const { snapshot, pathname, colorScheme } = detail
        const { filePath, exportName } = running.get(useRunnerID(colorScheme, pathname))!
        const selected = snapshot.find((msg) => msg.selected)
        if (selected) {
          const type = selected.type
          trigger({
            type,
            detail: {
              pathname,
              filePath,
              exportName,
              colorScheme,
              detail: selected?.detail,
            },
          })
        }
      },
      [TEST_RUNNER_EVENTS.test_end](detail) {
        running.delete(detail)
      },
      async [TEST_RUNNER_EVENTS.end]() {
        const report: TestStoriesOutput = {
          passed,
          failed,
        }
        reporter.set(report)
        running.clear()
        failed.length = 0
        passed.length = 0
      },
      [FIXTURE_EVENTS.failed_assertion]: handleFailure,
      [FIXTURE_EVENTS.missing_assertion_parameter]: handleFailure,
      [FIXTURE_EVENTS.test_timeout]: handleFailure,
      [FIXTURE_EVENTS.unknown_error]: handleFailure,
      [FIXTURE_EVENTS.accessibility_violation]: handleFailure,
      [FIXTURE_EVENTS.run_complete]: handleSuccess,
    }
  },
})
