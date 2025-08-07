import { chromium, type BrowserContext } from 'playwright'
import { bProgram } from '../behavioral.js'
import { STORY_RUNNER_EVENTS } from './story-runner.constants.js'
import { FIXTURE_EVENTS, type RunnerMessage } from '../testing.js'
import type { ColorScheme, RunningMap } from './story-runner.types.js'
import { useVisitStory, useRunnerID } from './story-runner.utils.js'
import type { StoryParams } from './story-server.types.js'

type FixtureEventDetail = {
  pathname: string
  filePath: string
  exportName: string
  context: BrowserContext
  colorScheme: ColorScheme
  detail: unknown
}

/**
 * @internal Defines the shape of event details for the `storyRunner` behavioral program.
 * This type maps event names (both from `STORY_RUNNER_EVENTS` and `FIXTURE_EVENTS`)
 * to their respective payload structures.
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
 * @internal Behavioral program for running Plaited stories in a headless browser environment.
 * It orchestrates the execution of multiple stories, manages browser contexts,
 * collects results, and reports successes or failures.
 *
 * @param options Configuration for the story runner.
 * @param options.serverURL The base URL of the server hosting the stories.
 *
 * Event Handling:
 * - Listens for `run_tests` to start processing a batch of stories.
 * - Listens for `on_runner_message` to receive messages (like snapshots or test outcomes) from individual story fixtures.
 * - Triggers `test_end` when a single story test (including its color scheme variations) completes.
 * - Triggers `end` when all stories have been processed.
 * - Handles various `FIXTURE_EVENTS` (e.g., `failed_assertion`, `run_complete`) to process individual test results.
 *
 * Responsibilities:
 * - Launches a Chromium browser instance.
 * - Manages a map (`running`) of active story tests.
 * - Iterates through provided story parameters and color schemes.
 * - Uses Playwright's `BrowserContext` to isolate tests.
 * - Navigates to story pages using `useVisitStory`.
 * - Tracks passed and failed test counts.
 * - Exits the process with appropriate status codes based on test outcomes (unless in `--hot` mode).
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
