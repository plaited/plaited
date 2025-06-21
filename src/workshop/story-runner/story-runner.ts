import { chromium, type BrowserContext } from 'playwright'
import { useSignal, type Signal, type SignalWithInitialValue } from '../../behavioral/use-signal.js'
import type { StoryParams } from '../workshop.types.js'
import { STORY_RUNNER_EVENTS } from './story-runner.constants.js'
import { FIXTURE_EVENTS } from '../story-fixture/story-fixture.constants.js'
import type { LogMessageDetail, ColorScheme } from './story-runner.types.js'
import { useVisitStory } from './story-runner.utils.js'
import { defineBProgram } from '../../behavioral/define-b-program.js'

type FixtureEventDetail = {
  url: string
  filePath: string
  exportName: string
  context: BrowserContext
  colorScheme: ColorScheme
  detail: unknown
}

export type RunnerDetails = {
  [STORY_RUNNER_EVENTS.run_tests]: Set<StoryParams>
  [STORY_RUNNER_EVENTS.log_event]: LogMessageDetail
  [STORY_RUNNER_EVENTS.end]: void
  [FIXTURE_EVENTS.failed_assertion]: FixtureEventDetail
  [FIXTURE_EVENTS.missing_assertion_parameter]: FixtureEventDetail
  [FIXTURE_EVENTS.test_timeout]: FixtureEventDetail
  [FIXTURE_EVENTS.unknown_error]: FixtureEventDetail
  [FIXTURE_EVENTS.run_complete]: FixtureEventDetail
  [FIXTURE_EVENTS.accessibility_violation]: FixtureEventDetail
}

export const storyRunner = defineBProgram<
  RunnerDetails,
  {
    colorSchemeSupport?: Signal<boolean>
    serverURL: URL
    storyParamSet: SignalWithInitialValue<Set<StoryParams>>
  }
>({
  publicEvents: [STORY_RUNNER_EVENTS.run_tests],
  async bProgram({ trigger, bThreads, bSync, bThread, colorSchemeSupport, serverURL, storyParamSet }) {
    const browser = await chromium.launch()

    storyParamSet.listen(STORY_RUNNER_EVENTS.run_tests, trigger)
    colorSchemeSupport?.listen(STORY_RUNNER_EVENTS.run_tests, trigger)

    const runningSignal = useSignal<Map<string, Set<string>>>(new Map())

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
              return runningSignal.get().size === 1
            },
          }),
          bSync({ request: { type: STORY_RUNNER_EVENTS.end } }),
        ],
        true,
      ),
    })
    let failed = 0
    let passed = 0
    const handleFailure = async ({ url, filePath, exportName, context, colorScheme, detail }: FixtureEventDetail) => {
      // Get running tests map
      const running = runningSignal.get()
      // Get color schemes for current test url
      const runningColorSchemes = running.get(url)!
      // Delete colorScheme from running set
      runningColorSchemes.delete(colorScheme)
      // If set is zeroed out delete url from running map
      !runningColorSchemes.size && running.delete(url)

      //Print out result
      console.table({
        url,
        filePath: `.${filePath}`,
        exportName,
        colorScheme,
      })
      console.table(detail)
      failed++
      // Close context
      await context.close()
    }

    const handleSuccess = async ({ url, context, colorScheme, detail }: FixtureEventDetail) => {
      // Get running tests map
      const running = runningSignal.get()
      // Get color schemes for current test url
      const runningColorSchemes = running.get(url)!
      // Delete colorScheme from running set
      runningColorSchemes.delete(colorScheme)
      // If set is zeroed out delete url from running map
      !runningColorSchemes.size && running.delete(url)

      //Print out result
      console.log(`${detail}:`, url)

      passed++
      // Close context
      await context.close()
    }
    return {
      async [STORY_RUNNER_EVENTS.run_tests](detail) {
        runningSignal.set(
          new Map(
            [...detail].map(({ route }) => {
              const url = new URL(route, serverURL).href
              const colorSchemes = ['light']
              colorSchemeSupport?.get() && colorSchemes.push('dark')
              return [url, new Set(colorSchemes)]
            }),
          ),
        )
        const visitStory = useVisitStory({
          browser,
          colorSchemeSupport,
          serverURL,
          trigger,
        })
        await Promise.all([...detail].map(visitStory))
      },
      [STORY_RUNNER_EVENTS.log_event](detail) {
        const { snapshot, route, filePath, context, colorScheme, exportName } = detail
        const url = new URL(route, serverURL).href
        const selected = snapshot.find((msg) => msg.selected)
        if (selected) {
          const type = selected.type
          trigger({
            type,
            detail: {
              url,
              filePath,
              exportName,
              context,
              colorScheme,
              detail: selected?.detail,
            },
          })
        }
      },
      async [STORY_RUNNER_EVENTS.end]() {
        runningSignal.set(new Map())
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
