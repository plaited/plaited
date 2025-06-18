import { chromium, type BrowserContext } from 'playwright'
import { bProgram } from '../../behavioral/b-program.js'
import { useSignal, type Signal, type SignalWithInitialValue } from '../../behavioral/use-signal.js'
import type { StoryParams} from '../workshop.types.js'
import {TESTING_EVENTS } from './testing.constants.js'
import { FIXTURE_EVENTS } from './plaited-fixture.constants.js'
import type { LogMessageDetail, ColorScheme } from './testing.types.js'
import { useVisitStory } from './use-visit-story.js'
import { bThread, bSync } from '../../behavioral/b-thread.js'

type FixtureEventDetail = {
    url: string;
    filePath: string;
    exportName: string;
    context: BrowserContext;
    colorScheme: ColorScheme;
    detail: unknown;
}

export type RunnerDetails = {
  [TESTING_EVENTS.RUN_TESTS]: Set<StoryParams>
  [TESTING_EVENTS.LOG_EVENT]: LogMessageDetail
  [TESTING_EVENTS.END]: void
  [FIXTURE_EVENTS.FAILED_ASSERTION]: FixtureEventDetail
  [FIXTURE_EVENTS.MISSING_ASSERTION_PARAMETER]: FixtureEventDetail
  [FIXTURE_EVENTS.TEST_TIMEOUT]: FixtureEventDetail
  [FIXTURE_EVENTS.UNKNOWN_ERROR]: FixtureEventDetail
  [FIXTURE_EVENTS.RUN_COMPLETE]: FixtureEventDetail
  [FIXTURE_EVENTS.ACCESSIBILITY_VIOLATION]: FixtureEventDetail
}

export const defineTesting = async ({
  colorSchemeSupportSignal,
  serverURL,
  storyParamSetSignal,
}: {
  colorSchemeSupportSignal: Signal<boolean>
  serverURL: URL
  storyParamSetSignal: SignalWithInitialValue<Set<StoryParams>>
}) => {
  const { useFeedback, trigger, bThreads } = bProgram()
  
  const browser = await chromium.launch()
  let passed = new Set<BrowserContext>()
  let failed = new Set<BrowserContext>()

  storyParamSetSignal.listen(TESTING_EVENTS.RUN_TESTS, trigger)
  colorSchemeSupportSignal.listen(TESTING_EVENTS.RUN_TESTS, trigger)
  
  const testCountSignal = useSignal<number>(0)


  bThreads.set({
    onCountChange: bThread([
      bSync({
        block: ({type}) => {
          const events = [
            FIXTURE_EVENTS.FAILED_ASSERTION,
            FIXTURE_EVENTS.MISSING_ASSERTION_PARAMETER,
            FIXTURE_EVENTS.TEST_TIMEOUT,
            FIXTURE_EVENTS.UNKNOWN_ERROR,
            FIXTURE_EVENTS.RUN_COMPLETE,
            FIXTURE_EVENTS.ACCESSIBILITY_VIOLATION,
          ]
          if(!events.includes(type as typeof events[number])) return false
          return testCountSignal.get() === passed.size + failed.size
        }
      }),
      bSync({ request: {type: TESTING_EVENTS.END}})
    ], true)
  })

  useFeedback<RunnerDetails>({
    async [TESTING_EVENTS.RUN_TESTS](detail) {
      passed = new Set<BrowserContext>()
      failed = new Set<BrowserContext>()
      testCountSignal.set(colorSchemeSupportSignal.get() ? detail.size * 2 : detail.size)
      const visitStory = useVisitStory({
        browser,
        colorSchemeSupportSignal,
        serverURL,
        trigger,
      })
      const testParams = [...detail]
      await Promise.all(testParams.map(visitStory))
    },
    [TESTING_EVENTS.LOG_EVENT](detail) {
      const { snapshot, route, filePath, context, colorScheme, exportName } = detail  
      const url = new URL(route, serverURL).href
      const selected = snapshot.find(msg => msg.selected)
      if(selected) {
        const type = selected.type
        trigger({type, detail:{
          url,
          filePath,
          exportName,
          context,
          colorScheme,
          detail: selected?.detail
        }})
      }
    },
    async [TESTING_EVENTS.END]() {
        await Promise.all([...passed, ...failed].map(async (context) => await context.close()))
      },
      [FIXTURE_EVENTS.FAILED_ASSERTION] (detail){
        console.dir(detail)
        failed.add(detail.context)
      },
      [FIXTURE_EVENTS.MISSING_ASSERTION_PARAMETER] (detail){
        console.dir(detail)
        failed.add(detail.context)
      },
      [FIXTURE_EVENTS.TEST_TIMEOUT] (detail){
        console.dir(detail)
        failed.add(detail.context)
      },
      [FIXTURE_EVENTS.UNKNOWN_ERROR] (detail){
        console.dir(detail)
        failed.add(detail.context)
      },
      [FIXTURE_EVENTS.ACCESSIBILITY_VIOLATION](detail){
        console.dir(detail)
        failed.add(detail.context)
      },
      [FIXTURE_EVENTS.RUN_COMPLETE] (detail){
        console.dir(detail)
        passed.add(detail.context)
      },
  })
}
