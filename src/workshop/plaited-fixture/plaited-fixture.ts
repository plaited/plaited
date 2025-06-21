import type { SnapshotMessage } from '../../behavioral/b-program.js'
import { css } from '../../main/css.js'
import { defineElement } from '../../main/define-element.js'
import { h } from '../../jsx/create-template.js'
import { wait } from '../../utils/wait.js'
import { PLAITED_FIXTURE, DEFAULT_PLAY_TIMEOUT, FIXTURE_EVENTS } from './plaited-fixture.constants.js'
import {
  FailedAssertionError,
  MissingAssertionParameterError,
  AccessibilityError,
  useWait,
  useAssert,
  match,
  throws,
  useFindByAttribute,
  useFindByText,
  useFireEvent,
  useAccessibilityCheck,
  useRunner,
} from './plaited-fixture.utils.js'
import type { InteractionStoryObj, Play, TestFailureEventDetail } from './plaited-fixture.types'

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
  [FIXTURE_EVENTS.run]: { play?: InteractionStoryObj['play']; timeout?: number }
  [FIXTURE_EVENTS.play]: { play: InteractionStoryObj['play']; timeout?: number }
}>({
  tag: PLAITED_FIXTURE,
  publicEvents: [FIXTURE_EVENTS.run],
  streamAssociated: true,
  shadowDom: h('slot', {
    ...css.host({
      display: 'contents',
    }),
  }),
  bProgram({ host, trigger, useSnapshot, bThreads, bThread, bSync }) {
    bThreads.set({
      onError: bThread(
        [
          bSync({
            waitFor: [
              FIXTURE_EVENTS.accessibility_violation,
              FIXTURE_EVENTS.failed_assertion,
              FIXTURE_EVENTS.missing_assertion_parameter,
              FIXTURE_EVENTS.unknown_error,
            ],
          }),
          bSync({
            block: [FIXTURE_EVENTS.run_complete, FIXTURE_EVENTS.test_timeout],
          }),
        ],
        true,
      ),
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
          accessibilityCheck: useAccessibilityCheck(trigger),
        })
      } catch (error) {
        if (error instanceof FailedAssertionError || error instanceof AccessibilityError) {
          trigger<TestFailureEventDetail>({
            type: error.name,
            detail: { [failure(error.name)]: JSON.parse(error.message) },
          })
        } else if (error instanceof MissingAssertionParameterError) {
          trigger<TestFailureEventDetail>({
            type: error.name,
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
      [FIXTURE_EVENTS.run](detail) {
        if (detail.play) {
          trigger({ type: FIXTURE_EVENTS.play, detail })
        } else {
          trigger({ type: FIXTURE_EVENTS.run_complete, detail: success() })
        }
      },
      async [FIXTURE_EVENTS.play](detail) {
        const timedOut = await Promise.race([interact(detail.play), timeout(detail.timeout ?? DEFAULT_PLAY_TIMEOUT)])
        if (timedOut) {
          trigger({ type: FIXTURE_EVENTS.test_timeout, detail: failure(FIXTURE_EVENTS.test_timeout) })
        } else {
          trigger({ type: FIXTURE_EVENTS.run_complete, detail: success() })
        }
      },
      onConnected() {
        trigger({
          type: FIXTURE_EVENTS.fixture_connected,
        })
      },
    }
  },
})
