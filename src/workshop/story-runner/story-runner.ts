import { chromium, type BrowserContext } from 'playwright'
import { bProgram } from '../../behavioral.js'
import { STORY_RUNNER_EVENTS } from './story-runner.constants.js'
import { type RunnerMessage } from '../../testing.js'
import { FIXTURE_EVENTS } from '../../testing/testing.constants.js'
import type { ColorScheme, RunningMap } from './story-runner.types.js'
import type { StoryParams } from '../story-server/story-server.types.js'
import { useVisitStory, useRunnerID } from './story-runner.utils.js'

type FixtureEventDetail = {
  pathname: string
  filePath: string
  exportName: string
  context: BrowserContext
  colorScheme: ColorScheme
  detail: unknown
}

/**
 * Event detail types for story runner behavioral program.
 * Maps event names to their payload structures.
 */
export type RunnerDetails = {
  [STORY_RUNNER_EVENTS.run_tests]: {
    storyParams: Set<StoryParams>
    colorSchemeSupport: boolean
  }
  [STORY_RUNNER_EVENTS.on_runner_message]: RunnerMessage
  [STORY_RUNNER_EVENTS.test_end]: string
  [STORY_RUNNER_EVENTS.end]: void
  [FIXTURE_EVENTS.failed_assertion]: FixtureEventDetail
  [FIXTURE_EVENTS.missing_assertion_parameter]: FixtureEventDetail
  [FIXTURE_EVENTS.test_timeout]: FixtureEventDetail
  [FIXTURE_EVENTS.unknown_error]: FixtureEventDetail
  [FIXTURE_EVENTS.run_complete]: FixtureEventDetail
  [FIXTURE_EVENTS.accessibility_violation]: FixtureEventDetail
}

/**
 * Behavioral program for automated story testing.
 * Orchestrates browser-based test execution with Playwright.
 *
 * @param options - Runner configuration
 * @param options.serverURL - Base URL of story server
 *
 * @example Test execution flow
 * ```ts
 * // 1. Receives run_tests event with stories
 * // 2. Launches Chromium browser
 * // 3. Creates isolated contexts per test
 * // 4. Runs tests in parallel
 * // 5. Collects results and reports
 * ```
 *
 * @remarks
 * Events:
 * - Listens: run_tests, on_runner_message
 * - Triggers: test_end, end
 * - Handles: assertion failures, timeouts, completions
 *
 * @see {@link STORY_RUNNER_EVENTS} for event types
 * @see {@link useVisitStory} for navigation
 */
export const storyRunner = bProgram<
  RunnerDetails,
  {
    serverURL: URL
  }
>({
  publicEvents: [STORY_RUNNER_EVENTS.run_tests, STORY_RUNNER_EVENTS.on_runner_message],
  async bProgram({ trigger, bThreads, bSync, bThread, serverURL }) {
    const browser = await chromium.launch()

    let failed = 0
    let passed = 0
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
          bSync({ request: { type: STORY_RUNNER_EVENTS.end } }),
        ],
        true,
      ),
    })

    const handleFailure = async ({
      pathname,
      filePath,
      exportName,
      context,
      colorScheme,
      detail,
    }: FixtureEventDetail) => {
      trigger({ type: STORY_RUNNER_EVENTS.test_end, detail: useRunnerID(pathname, colorScheme) })
      //Print out result
      console.table({
        url: new URL(pathname, serverURL).href,
        filePath: `.${filePath}`,
        exportName,
        colorScheme,
      })
      console.table(detail)
      failed++
      // Close context
      await context.close()
    }

    const handleSuccess = async ({ pathname, context, colorScheme, detail }: FixtureEventDetail) => {
      trigger({ type: STORY_RUNNER_EVENTS.test_end, detail: useRunnerID(pathname, colorScheme) })
      //Print out result
      console.log(`${detail}:`, new URL(pathname, serverURL).href)

      passed++
      // Close context
      await context.close()
    }
    return {
      async [STORY_RUNNER_EVENTS.run_tests]({ storyParams, colorSchemeSupport }) {
        const schemes = ['light', colorSchemeSupport && 'dark'].filter(Boolean) as string[]
        const visitStory = useVisitStory({
          browser,
          colorSchemeSupport,
          serverURL,
          running,
        })
        await Promise.all(
          [...storyParams].map(async (params) => {
            const route = params.route
            for (const scheme of schemes) {
              const type = `${route}_${scheme}`
              bThreads.set({
                [`on_${type}`]: bThread([
                  bSync({
                    waitFor: type,
                  }),
                  bSync({
                    request: {
                      type: STORY_RUNNER_EVENTS.test_end,
                      detail: type,
                    },
                  }),
                ]),
              })
            }
            await visitStory(params)
          }),
        )
      },
      [STORY_RUNNER_EVENTS.on_runner_message](detail) {
        const { snapshot, pathname, colorScheme } = detail
        const { filePath, exportName, context } = running.get(useRunnerID(pathname, colorScheme))!
        const selected = snapshot.find((msg) => msg.selected)
        if (selected) {
          const type = selected.type
          trigger({
            type,
            detail: {
              pathname,
              filePath,
              exportName,
              context,
              colorScheme,
              detail: selected?.detail,
            },
          })
        }
      },
      [STORY_RUNNER_EVENTS.test_end](detail) {
        running.delete(detail)
      },
      async [STORY_RUNNER_EVENTS.end]() {
        running.clear()
        if (!process.execArgv.includes('--hot')) {
          console.log('Fail: ', failed)
          console.log('Pass: ', passed)
          failed ? process.exit(1) : process.exit(0)
        } else {
          failed = 0
        }
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
