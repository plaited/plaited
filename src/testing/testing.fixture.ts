declare global {
  interface Window {
    /**
     * @internal
     * Global flag indicating if the current context is within the Plaited test runner environment.
     * This helps conditional logic, like snapshot reporting, to behave differently when running
     * inside the test runner versus a standard browser environment.
     */
    __PLAITED_RUNNER__?: boolean
  }
}

import * as css from 'plaited/css'
import type { SnapshotMessage } from '../behavioral.js'
import { bElement, h } from '../main.js'
import { wait } from '../utils.js'
import { STORY_FIXTURE, DEFAULT_PLAY_TIMEOUT, FIXTURE_EVENTS } from './testing.constants.js'
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
  useFindByTarget,
  useFindByTestId,
} from './testing.utils.js'
import type { InteractionStoryObj, Play, TestFailureEventDetail } from './testing.types.js'

/**
 * Story test fixture component for Plaited testing framework.
 * Executes story tests, manages test lifecycle, and reports results.
 *
 * @example Test execution flow
 * ```tsx
 * // Story fixture automatically:
 * // 1. Receives test configuration
 * // 2. Runs play function with utilities
 * // 3. Reports results via WebSocket
 * // 4. Handles timeouts and errors
 *
 * const story: StoryObj = {
 *   description: 'Button interaction test',
 *   play: async ({ assert, fireEvent, findByText }) => {
 *     const button = await findByText('Click me');
 *     await fireEvent(button, 'click');
 *     assert({
 *       given: 'button clicked',
 *       should: 'update state',
 *       actual: button.textContent,
 *       expected: 'Clicked!'
 *     });
 *   }
 * };
 * ```
 *
 * @remarks
 * Features:
 * - Automatic error handling
 * - WebSocket communication
 * - Snapshot reporting
 * - Timeout management
 * - Accessibility testing
 *
 * @see {@link StoryObj} for story configuration
 * @see {@link Play} for test utilities
 */
export const StoryFixture = bElement<{
  [FIXTURE_EVENTS.run]: { play?: InteractionStoryObj['play']; timeout?: number }
  [FIXTURE_EVENTS.play]: { play: InteractionStoryObj['play']; timeout?: number }
}>({
  tag: STORY_FIXTURE,
  publicEvents: [FIXTURE_EVENTS.run],
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
    const send = useRunner()
    useSnapshot((snapshot: SnapshotMessage) => {
      if (window?.__PLAITED_RUNNER__) {
        const { pathname } = new URL(window.location.href)
        send({
          colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
          snapshot,
          pathname,
        })
      } else {
        console.table(snapshot)
      }
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
          findByTarget: useFindByTarget(trigger),
          findByTestId: useFindByTestId(trigger),
          hostElement: host,
          match,
          throws,
          wait: useWait(trigger),
          accessibilityCheck: useAccessibilityCheck(trigger),
        })
      } catch (error) {
        if (error instanceof FailedAssertionError || error instanceof AccessibilityError) {
          trigger<{
            type: typeof FIXTURE_EVENTS.failed_assertion | typeof FIXTURE_EVENTS.accessibility_violation
            detail: TestFailureEventDetail
          }>({
            type: error.name,
            detail: { [failure(error.name)]: JSON.parse(error.message) },
          })
        } else if (error instanceof MissingAssertionParameterError) {
          trigger<{ type: typeof FIXTURE_EVENTS.missing_assertion_parameter; detail: TestFailureEventDetail }>({
            type: error.name,
            detail: { [failure(error.name)]: error.message },
          })
        } else if (error instanceof Error) {
          trigger<{ type: string; detail: TestFailureEventDetail }>({
            type: FIXTURE_EVENTS.unknown_error,
            detail: { [failure(error.name)]: error.message },
          })
        }
      }
    }

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
      onDisconnected() {
        send.disconnect()
      },
    }
  },
})
