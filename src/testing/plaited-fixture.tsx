import { bElement, createHostStyles } from '../main.ts'
import { wait } from '../utils.ts'
import {
  __PLAITED__,
  __PLAITED_RUNNER__,
  DEFAULT_PLAY_TIMEOUT,
  ERROR_TYPES,
  FIXTURE_EVENTS,
  STORY_FIXTURE,
  SUCCESS_TYPES,
} from './testing.constants.ts'
import type {
  AccessibilityCheckParams,
  AssertParams,
  FindByAttributeArgs,
  FindByTargetArgs,
  FindByTestIdArgs,
  FindByTextArgs,
  FireEventArgs,
  InteractionStoryObj,
  RunnerMessage,
} from './testing.types.ts'
import {
  accessibilityCheck,
  assert,
  findByAttribute,
  findByTarget,
  findByTestId,
  findByText,
  fireEvent,
} from './testing.utils.ts'
import { useInteract } from './use-interact.ts'

declare global {
  interface Window {
    /**
     * @internal
     * Global flag indicating if the current context is within the Plaited test runner environment.
     * This helps conditional logic, like snapshot reporting, to behave differently when running
     * inside the test runner versus a standard browser environment.
     */
    [__PLAITED_RUNNER__]?: boolean
    [__PLAITED__]: {
      reporter: () => Promise<RunnerMessage>
    }
  }
}

/**
 * Story test fixture component for Plaited testing framework.
 * Executes story tests, manages test lifecycle, and reports results.
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

type FindElementReturn = HTMLElement | SVGElement | undefined

type RejectParams = {
  errorType: string
  error: string
}
type Reject = (value: RejectParams | PromiseLike<RejectParams>) => void

export const PlaitedFixture = bElement<{
  [FIXTURE_EVENTS.accessibility_check]: {
    args: AccessibilityCheckParams
    resolve: () => void
    reject: Reject
  }
  [FIXTURE_EVENTS.assertion]: AssertParams
  [FIXTURE_EVENTS.find_by_attribute]: {
    args: FindByAttributeArgs
    resolve: (value: FindElementReturn | PromiseLike<FindElementReturn>) => void
    reject: Reject
  }
  [FIXTURE_EVENTS.find_by_target]: {
    args: FindByTargetArgs
    resolve: (value: FindElementReturn | PromiseLike<FindElementReturn>) => void
    reject: Reject
  }
  [FIXTURE_EVENTS.find_by_test_id]: {
    args: FindByTestIdArgs
    resolve: (value: FindElementReturn | PromiseLike<FindElementReturn>) => void
    reject: Reject
  }
  [FIXTURE_EVENTS.find_by_text]: {
    args: FindByTextArgs
    resolve: (value: FindElementReturn | PromiseLike<FindElementReturn>) => void
    reject: Reject
  }
  [FIXTURE_EVENTS.fire_event]: {
    args: FireEventArgs
    resolve: () => void
    reject: Reject
  }
  [FIXTURE_EVENTS.play]: {
    play: InteractionStoryObj['play']
    timeout?: number
  }
  [FIXTURE_EVENTS.run]: {
    play?: InteractionStoryObj['play']
    timeout?: number
  }
  [FIXTURE_EVENTS.test_fail]: {
    errorType: string
    error: string
    stack?: string
  }
  [FIXTURE_EVENTS.test_pass]: string
  [FIXTURE_EVENTS.wait]: {
    args: number
    resolve: () => void
    reject: Reject
  }
}>({
  tag: STORY_FIXTURE,
  publicEvents: [FIXTURE_EVENTS.run],
  shadowDom: (
    <slot
      {...createHostStyles({
        display: 'block',
        width: '100%',
        height: '100%',
      })}
    />
  ),
  bProgram({ trigger, bThreads, bThread, bSync, emit }) {
    bThreads.set({
      onRun: bThread(
        [
          bSync({
            waitFor: [FIXTURE_EVENTS.test_fail, FIXTURE_EVENTS.test_pass],
          }),
          bSync({
            block: [FIXTURE_EVENTS.test_pass, FIXTURE_EVENTS.test_fail],
          }),
        ],
        true,
      ),
    })

    const timeout = async (time: number) => {
      await wait(time)
      return true
    }

    const { resolve, promise } = Promise.withResolvers<RunnerMessage>()
    window.__PLAITED__ = {
      reporter: async () => promise,
    }
    const handleError = (error: unknown, reject?: Reject) => {
      if (error instanceof Error) {
        const detail = {
          errorType: error.name,
          error: error.toString(),
          stack: error.stack,
        }
        trigger({
          type: FIXTURE_EVENTS.test_fail,
          detail,
        })
        reject?.(detail)
      } else {
        const detail = {
          errorType: ERROR_TYPES.unknown_error,
          error: `${error}`,
        }
        trigger({
          type: FIXTURE_EVENTS.test_fail,
          detail,
        })
        reject?.(detail)
      }
    }
    const interact = useInteract(trigger)
    return {
      async [FIXTURE_EVENTS.accessibility_check]({ args, resolve, reject }) {
        try {
          await accessibilityCheck(args)
          trigger({ type: SUCCESS_TYPES.passed_accessibility_check })
          resolve()
        } catch (error) {
          handleError(error, reject)
        }
      },
      [FIXTURE_EVENTS.assertion](detail) {
        try {
          assert(detail)
          trigger({ type: SUCCESS_TYPES.passed_assertion })
        } catch (error) {
          handleError(error)
        }
      },
      async [FIXTURE_EVENTS.find_by_attribute]({ args, resolve, reject }) {
        try {
          const result = await findByAttribute(...args)
          resolve(result)
        } catch (error) {
          handleError(error, reject)
        }
      },
      async [FIXTURE_EVENTS.find_by_target]({ args, resolve, reject }) {
        try {
          const result = await findByTarget(...args)
          resolve(result)
        } catch (error) {
          handleError(error, reject)
        }
      },
      async [FIXTURE_EVENTS.find_by_test_id]({ args, resolve, reject }) {
        try {
          const result = await findByTestId(...args)
          resolve(result)
        } catch (error) {
          handleError(error, reject)
        }
      },
      async [FIXTURE_EVENTS.find_by_text]({ args, resolve, reject }) {
        try {
          const result = await findByText(...args)
          resolve(result)
        } catch (error) {
          handleError(error, reject)
        }
      },
      async [FIXTURE_EVENTS.fire_event]({ args, resolve, reject }) {
        try {
          await fireEvent(...args)
          resolve()
        } catch (error) {
          handleError(error, reject)
        }
      },
      async [FIXTURE_EVENTS.play](detail) {
        const timedOut = await Promise.race([interact(detail.play), timeout(detail.timeout ?? DEFAULT_PLAY_TIMEOUT)])
        if (timedOut) {
          trigger({
            type: FIXTURE_EVENTS.test_fail,
            detail: {
              errorType: ERROR_TYPES.test_timeout,
              error: `⏱️ ${ERROR_TYPES.test_timeout}`,
            },
          })
        } else {
          trigger({ type: FIXTURE_EVENTS.test_pass, detail: '✅ Success' })
        }
      },
      [FIXTURE_EVENTS.run](detail) {
        if (detail.play) {
          trigger({ type: FIXTURE_EVENTS.play, detail })
        } else {
          trigger({ type: FIXTURE_EVENTS.test_pass, detail: '✅ Success' })
        }
      },
      [FIXTURE_EVENTS.test_fail](detail) {
        const { pathname } = new URL(window.location.href)
        emit({ type: FIXTURE_EVENTS.test_fail, detail })
        resolve({
          type: FIXTURE_EVENTS.test_fail,
          detail: {
            pathname,
            errorType: detail.errorType,
            error: detail.error,
          },
        })
      },
      [FIXTURE_EVENTS.test_pass](detail) {
        const { pathname } = new URL(window.location.href)
        emit({ type: FIXTURE_EVENTS.test_pass, detail })
        resolve({
          type: FIXTURE_EVENTS.test_pass,
          detail: {
            pathname,
          },
        })
      },
      async [FIXTURE_EVENTS.wait]({ args, resolve, reject }) {
        try {
          await wait(args)
          resolve()
        } catch (error) {
          handleError(error, reject)
        }
      },
    }
  },
})
