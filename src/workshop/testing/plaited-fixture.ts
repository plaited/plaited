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


/**
 * Trims the error name and message from the top of a stack trace string.
 * @param {string} stack - The full error.stack string.
 * @returns {string} - A string containing only the trace lines.
 */
const getTraceOnly = (stack: string) => {
  // Split the stack string into an array of lines.
  const lines = stack.split('\n')
  // Find the index of the first line that starts with " at ", which marks
  // the beginning of the actual trace in most JavaScript environments.
  // We use .trim() to handle potential leading whitespace.
  const firstTraceLineIndex = lines.findIndex((line) => line.trim().startsWith('at '))

  if (firstTraceLineIndex !== -1) {
    // If a trace line is found, slice the array from that line to the end,
    // and then join it back into a single string.
    return lines.slice(firstTraceLineIndex).join('\n')
  }
  // Fallback: If no line starts with " at ", it might be a different format
  // or just the error message itself. We'll conservatively return the original
  // stack, as we can't be sure where the message ends and the trace begins.
  return stack
}

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
        if (error instanceof FailedAssertionError ||
          error instanceof MissingAssertionParameterError ||
          error instanceof AccessibilityError
        ) {
          trigger<TestFailureEventDetail>({
            type:error.name,
            detail: {
              name: error?.name,
              message: error.message,
              url: window?.location.href,
              trace: getTraceOnly(error.stack ?? 'no trace'),
            },
          })
        } else if (error instanceof Error) {
          trigger<TestFailureEventDetail>({
            type: error.name,
            detail: {
              name: error?.name,
              message: error?.message,
              trace: getTraceOnly(error.stack ?? 'no trace'),
              url: window?.location.href,
            },
          })
        }
      }
    }
    
    return {
      [FIXTURE_EVENTS.RUN](detail) {
        if(detail.play) {
          trigger({type: FIXTURE_EVENTS.PLAY, detail})
        } else {
          trigger({ type: FIXTURE_EVENTS.RUN_COMPLETE })
        }
      },
      async [FIXTURE_EVENTS.PLAY](detail) {
          const timedOut = await Promise.race([interact(detail.play), timeout(detail.timeout ?? DEFAULT_PLAY_TIMEOUT)])
          if (timedOut) {
            trigger({ type: FIXTURE_EVENTS.TEST_TIMEOUT })
          } else {
            trigger({ type: FIXTURE_EVENTS.RUN_COMPLETE })
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
