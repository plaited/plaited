import type { SnapshotMessage } from '../../behavioral/b-program.js'
import { css } from '../../main/css.js'
import { defineElement } from '../../main/define-element.js'
import { h } from '../../jsx/create-template.js'
import { wait } from '../../utils/wait.js'
import { PLAITED_FIXTURE, DEFAULT_PLAY_TIMEOUT, FIXTURE_EVENTS } from './plaited-fixture.constants.js'
import { FailedAssertionError, MissingAssertionParameterError, AccessibilityError } from './errors.js'
import type { InteractionStoryObj, Play, TestFailureEventDetail } from './plaited-fixture.types'
import { useWait } from './use-wait.js'
import { useAssert } from './use-assert.js'
import { match } from './match.js'
import { throws } from './throws.js'
import { useFindByAttribute } from './use-find-by-attribute.js'
import { useFindByText } from './use-find-by-text.js'
import { useFireEvent } from './use-fire-event.js'
import { useCheckA11y } from './use-check-a11y.js'
import { useRunner } from './use-runner.js'

/**
 * @element plaited-test-fixture
 * @description A custom element designed to host and execute a single Plaited story test.
 * It receives test parameters via attributes, connects to the test runner via WebSocket
 * loads the specified story module, executes its `play` function (if defined),
 * and reports results or errors back to the runner.
 * @fires play - Dispatched internally to initiate the story's play function execution.
 *
 * @example
 * ```html
 * <plaited-test-fixture >
 *   <!-- The rendered story component will be placed here by the test runner -->
 * </plaited-test-fixture>
 * ```
 */
export const PlaitedFixture = defineElement<{
  [FIXTURE_EVENTS.RUN]: { play?: InteractionStoryObj['play']; timeout?: number }
  [FIXTURE_EVENTS.PLAY]:  { play: InteractionStoryObj['play']; timeout?: number }
}>({
  tag: PLAITED_FIXTURE,
  publicEvents: [FIXTURE_EVENTS.RUN],
  streamAssociated: true,
  shadowDom: h('slot', {
    ...css.host({
      display: 'contents',
    }),
  }),
  bProgram({ host, trigger, useSnapshot, bThreads, bThread, bSync }) {

    bThreads.set({
      onError: bThread([
        bSync({
          waitFor: [FIXTURE_EVENTS.ACCESSIBILITY_VIOLATION, FIXTURE_EVENTS.FAILED_ASSERTION, FIXTURE_EVENTS.MISSING_ASSERTION_PARAMETER, FIXTURE_EVENTS.UNKNOWN_ERROR]
        }),
        bSync({
          block: [FIXTURE_EVENTS.RUN_COMPLETE, FIXTURE_EVENTS.TEST_TIMEOUT]
        })
      ], true)
    })

    useSnapshot((snapshot: SnapshotMessage) => {
      console.table(snapshot)
    })

    const timeout = async (time: number) => {
      await wait(time)
      return true
    }

    const success = () => '\x1b[32m ✓ \x1b[0m' + 'Success'
    const failure = (label: string) => `\x1b[31m ${label} \x1b[0m`

    const interact = async (play: Play) => {
      try {
        await play?.({
          assert: useAssert(trigger),
          findByAttribute: useFindByAttribute(trigger),
          findByText: useFindByText(trigger),
          fireEvent: useFireEvent(trigger),
          hostElement: host,
          match,
          throws,
          wait: useWait(trigger),
          checkA11y: useCheckA11y(trigger)
        })
      } catch (error) {
        if(
          error instanceof FailedAssertionError||
          error instanceof AccessibilityError
        ) {
          trigger<TestFailureEventDetail>({
            type:error.name,
            detail: { [failure(error.name)]: JSON.parse(error.message)},
          })
        }else if (
          error instanceof MissingAssertionParameterError 
        ) {
          trigger<TestFailureEventDetail>({
            type:error.name,
            detail: { [failure(error.name)]: error.message },
          })
        } else if (error instanceof Error) {
          trigger<TestFailureEventDetail>({
            type: error.name,
            detail: { [failure(error.name)]: error.message },
          })
        }
      }
    }
    useRunner()
    return {
      [FIXTURE_EVENTS.RUN](detail) {
        if(detail.play) {
          trigger({type: FIXTURE_EVENTS.PLAY, detail})
        } else {
          trigger({ type: FIXTURE_EVENTS.RUN_COMPLETE, detail: success()})
        }
      },
      async [FIXTURE_EVENTS.PLAY](detail) {
          const timedOut = await Promise.race([interact(detail.play), timeout(detail.timeout ?? DEFAULT_PLAY_TIMEOUT)])
          if (timedOut) {
            trigger({ type: FIXTURE_EVENTS.TEST_TIMEOUT, detail: failure(FIXTURE_EVENTS.TEST_TIMEOUT) })
          } else {
            trigger({ type: FIXTURE_EVENTS.RUN_COMPLETE, detail: success() })
          } 
      },
      onConnected() {
        trigger({
          type: FIXTURE_EVENTS.FIXTURE_CONNECTED,
        })
      },
    }
  },
})
