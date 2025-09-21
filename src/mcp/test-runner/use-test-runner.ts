import { chromium, type BrowserContext } from 'playwright'
import type { BSync, BThread, BThreads, Trigger } from '../../main.js'
import { type RunnerMessage } from '../../testing.js'
import { TEST_RUNNER_EVENTS } from './test-runner.constants.js'
import { FIXTURE_EVENTS } from '../../testing/testing.constants.js'
import type { ColorScheme, RunningMap, StoryParams } from './test-runner.types.js'
import { useVisitStory, useRunnerID } from './use-visit-story.js'
import { type Server } from '@modelcontextprotocol/sdk/server/index.js'

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
  [TEST_RUNNER_EVENTS.run_tests]: {
    storyParams: Set<StoryParams>
    colorSchemeSupport: boolean
  }
  [TEST_RUNNER_EVENTS.on_runner_message]: RunnerMessage
  [TEST_RUNNER_EVENTS.test_end]: string
  [TEST_RUNNER_EVENTS.end]: void
  [FIXTURE_EVENTS.failed_assertion]: FixtureEventDetail
  [FIXTURE_EVENTS.missing_assertion_parameter]: FixtureEventDetail
  [FIXTURE_EVENTS.test_timeout]: FixtureEventDetail
  [FIXTURE_EVENTS.unknown_error]: FixtureEventDetail
  [FIXTURE_EVENTS.run_complete]: FixtureEventDetail
  [FIXTURE_EVENTS.accessibility_violation]: FixtureEventDetail
}

type TestResult = {
  detail: unknown
  meta: {
    url: string
    filePath: string
    exportName: string
    colorScheme: ColorScheme
  }
}

export const useTestRunner = async ({
  bSync,
  bThread,
  bThreads,
  trigger,
  serverURL,
  mcpServer,
}: {
  bThreads: BThreads
  trigger: Trigger
  bSync: BSync
  bThread: BThread
  serverURL: string
  mcpServer: Server
}) => {
  const browser = await chromium.launch()

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

  const handleFailure = async ({
    pathname,
    filePath,
    exportName,
    context,
    colorScheme,
    detail,
  }: FixtureEventDetail) => {
    trigger({ type: TEST_RUNNER_EVENTS.test_end, detail: useRunnerID(pathname, colorScheme) })

    failed.push({
      detail,
      meta: {
        url: new URL(pathname, serverURL).href,
        filePath: `.${filePath}`,
        exportName,
        colorScheme,
      },
    })

    await context.close()
  }

  const handleSuccess = async ({
    pathname,
    context,
    colorScheme,
    detail,
    filePath,
    exportName,
  }: FixtureEventDetail) => {
    trigger({ type: TEST_RUNNER_EVENTS.test_end, detail: useRunnerID(pathname, colorScheme) })

    passed.push({
      detail,
      meta: {
        url: new URL(pathname, serverURL).href,
        filePath: `.${filePath}`,
        exportName,
        colorScheme,
      },
    })

    await context.close()
  }

  return {
    async [TEST_RUNNER_EVENTS.run_tests]({ storySets, colorSchemeSupport }) {
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
                    type: TEST_RUNNER_EVENTS.test_end,
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
    [TEST_RUNNER_EVENTS.on_runner_message](detail) {
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
    [TEST_RUNNER_EVENTS.test_end](detail) {
      running.delete(detail)
    },
    async [TEST_RUNNER_EVENTS.end]() {
      running.clear()
      failed.length = 0
      passed.length = 0
      // if (!process.execArgv.includes('--hot')) {
      //   console.log('Fail: ', failed)
      //   console.log('Pass: ', passed)
      //   failed ? process.exit(1) : process.exit(0)
      // } else {
      //   failed = 0
      // }
    },
    [FIXTURE_EVENTS.failed_assertion]: handleFailure,
    [FIXTURE_EVENTS.missing_assertion_parameter]: handleFailure,
    [FIXTURE_EVENTS.test_timeout]: handleFailure,
    [FIXTURE_EVENTS.unknown_error]: handleFailure,
    [FIXTURE_EVENTS.accessibility_violation]: handleFailure,
    [FIXTURE_EVENTS.run_complete]: handleSuccess,
  }
}
