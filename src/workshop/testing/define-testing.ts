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

  storyParamSetSignal.listen(TESTING_EVENTS.RUN_TESTS, trigger)
  colorSchemeSupportSignal.listen(TESTING_EVENTS.RUN_TESTS, trigger)
  
  const runningSignal = useSignal<Map<string, Set<string>>>(new Map())


  bThreads.set({
    onCountChange: bThread([
      bSync({
        waitFor: ({type}) => {
          const events = [
            FIXTURE_EVENTS.FAILED_ASSERTION,
            FIXTURE_EVENTS.MISSING_ASSERTION_PARAMETER,
            FIXTURE_EVENTS.TEST_TIMEOUT,
            FIXTURE_EVENTS.UNKNOWN_ERROR,
            FIXTURE_EVENTS.RUN_COMPLETE,
            FIXTURE_EVENTS.ACCESSIBILITY_VIOLATION,
          ]
          if(!events.includes(type as typeof events[number])) return false
          return runningSignal.get().size === 1
        }
      }),
      bSync({ request: {type: TESTING_EVENTS.END}})
    ], true)
  })

  const handleFailure = async ({
        url,
        filePath,
        exportName,
        context,
        colorScheme,
        detail
      }: FixtureEventDetail) => {
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

        // Close context
        await context.close()
      }

      const handleSuccess = async ({
        url,
        context,
        colorScheme,
        detail
      }: FixtureEventDetail) => {
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

        // Close context
        await context.close()
      }

  useFeedback<RunnerDetails>({
    async [TESTING_EVENTS.RUN_TESTS](detail) {
      runningSignal.set(new Map([...detail].map( ({route})=> { 
        const url = new URL(route, serverURL).href
        const colorSchemes = ["light"]
        colorSchemeSupportSignal.get() && colorSchemes.push("dark")
        return [url, new Set(colorSchemes)]
      })))
      const visitStory = useVisitStory({
        browser,
        colorSchemeSupportSignal,
        serverURL,
        trigger,
      })
      for(const storyParam of detail) {
        await visitStory(storyParam)
      }
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
      runningSignal.set(new Map())
      },
      [FIXTURE_EVENTS.FAILED_ASSERTION]: handleFailure,
      [FIXTURE_EVENTS.MISSING_ASSERTION_PARAMETER]: handleFailure,
      [FIXTURE_EVENTS.TEST_TIMEOUT]: handleFailure,
      [FIXTURE_EVENTS.UNKNOWN_ERROR]: handleFailure,
      [FIXTURE_EVENTS.ACCESSIBILITY_VIOLATION]: handleFailure,
      [FIXTURE_EVENTS.RUN_COMPLETE]: handleSuccess,
  })
}
