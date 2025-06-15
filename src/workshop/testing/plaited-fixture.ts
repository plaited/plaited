import type { SnapshotMessage } from '../../behavioral/b-program.js'
import { css } from '../../main/css.js'
import { defineElement } from '../../main/define-element.js'
import { h } from '../../jsx/create-template.js'
import { wait } from '../../utils/wait.js'
import { PLAITED_FIXTURE, FIXTURE_EVENTS, DEFAULT_PLAY_TIMEOUT } from './plaited-fixture.constants.js'
import { FailedAssertionError, MissingAssertionParameterError } from './errors.js'
import type { InteractionStoryObj, Play, TestFailureEvent } from './plaited-fixture.types'
import { useWait } from './use-wait.js'
import { useAssert } from './use-assert.js'
import { match } from './match.js'
import { throws } from './throws.js'
import { useFindByAttribute } from './use-find-by-attribute.js'
import { useFindByText } from './use-find-by-text.js'
import { useFireEvent } from './use-fire-event.js'
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
  [FIXTURE_EVENTS.PLAY]?: { play: InteractionStoryObj['play']; timeout?: number }
}>({
  tag: PLAITED_FIXTURE,
  publicEvents: [FIXTURE_EVENTS.PLAY],
  streamAssociated: true,
  shadowDom: h('slot', {
    ...css.host({
      display: 'contents',
    }),
  }),
  bProgram({ host, trigger, useSnapshot }) {
    useSnapshot((snapshot: SnapshotMessage) => {
      console.dir(snapshot)
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
        })
        trigger({ type: FIXTURE_EVENTS.TEST_PASSED })
      } catch (error) {
        if (error instanceof FailedAssertionError || error instanceof MissingAssertionParameterError) {
          const event: TestFailureEvent = {
            type:
              error instanceof FailedAssertionError ?
                FIXTURE_EVENTS.FAILED_ASSERTION
              : FIXTURE_EVENTS.MISSING_ASSERTION_PARAMETER,
            detail: {
              name: error?.name,
              message: error.message,
              url: window?.location.href,
              trace: getTraceOnly(error.stack ?? 'no trace'),
            },
          }
          trigger(event)
        } else if (error instanceof Error) {
          const event: TestFailureEvent = {
            type: FIXTURE_EVENTS.UNKNOWN_ERROR,
            detail: {
              name: error?.name,
              message: error?.message,
              trace: getTraceOnly(error.stack ?? 'no trace'),
              url: window?.location.href,
            },
          }
          trigger(event)
        }
      }
    }
    return {
      async [FIXTURE_EVENTS.PLAY](detail) {
        if (detail) {
          const timedOut = await Promise.race([interact(detail.play), timeout(detail.timeout ?? DEFAULT_PLAY_TIMEOUT)])
          if (timedOut) trigger({ type: FIXTURE_EVENTS.TEST_TIMEOUT })
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
