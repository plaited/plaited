import { bElement, createHostStyles, type FunctionTemplate, type SnapshotMessage } from '../main.ts'
import { wait } from '../utils.ts'
import {
  __PLAITED__,
  __PLAITED_RUNNER__,
  DEFAULT_PLAY_TIMEOUT,
  ERROR_TYPES,
  FIXTURE_EVENTS,
  STORY_FIXTURE,
  STORY_IDENTIFIER,
  STORY_TYPES,
} from './testing.constants.ts'
import type {
  InteractionExport,
  InteractionStoryObj,
  Play,
  RunnerMessage,
  SnapshotExport,
  SnapshotStoryObj,
  StoryExport,
  StoryObj,
} from './testing.types.ts'
import {
  AccessibilityError,
  accessibilityCheck,
  assert,
  FailedAssertionError,
  findByAttribute,
  findByTarget,
  findByTestId,
  findByText,
  fireEvent,
  MissingAssertionParameterError,
  match,
  throws,
} from './testing.utils.ts'

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
const StoryFixture = bElement<{
  [FIXTURE_EVENTS.run]: {
    play?: InteractionStoryObj['play']
    timeout?: number
  }
  [FIXTURE_EVENTS.play]: {
    play: InteractionStoryObj['play']
    timeout?: number
  }
  [FIXTURE_EVENTS.test_fail]: {
    errorType:
      | typeof ERROR_TYPES.failed_assertion
      | typeof ERROR_TYPES.accessibility_violation
      | typeof ERROR_TYPES.missing_assertion_parameter
      | typeof ERROR_TYPES.unknown_error
      | typeof ERROR_TYPES.test_timeout
    error: string
  }
  [FIXTURE_EVENTS.test_pass]: string
}>({
  tag: STORY_FIXTURE,
  publicEvents: [FIXTURE_EVENTS.run],
  shadowDom: (
    <slot
      {...createHostStyles({
        display: 'contents',
      })}
    />
  ),
  bProgram({ host, trigger, useSnapshot, bThreads, bThread, bSync }) {
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
    !window?.__PLAITED_RUNNER__ &&
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
          assert,
          findByAttribute,
          findByText,
          fireEvent,
          findByTarget,
          findByTestId,
          hostElement: host,
          match,
          throws,
          wait,
          accessibilityCheck,
        })
      } catch (error) {
        if (error instanceof FailedAssertionError) {
          trigger({
            type: FIXTURE_EVENTS.test_fail,
            detail: {
              errorType: ERROR_TYPES.failed_assertion,
              error: error.toString(),
            },
          })
        } else if (error instanceof AccessibilityError) {
          trigger({
            type: FIXTURE_EVENTS.test_fail,
            detail: {
              errorType: ERROR_TYPES.accessibility_violation,
              error: error.toString(),
            },
          })
        } else if (error instanceof MissingAssertionParameterError) {
          trigger({
            type: FIXTURE_EVENTS.test_fail,
            detail: {
              errorType: ERROR_TYPES.missing_assertion_parameter,
              error: error.toString(),
            },
          })
        } else if (error instanceof Error) {
          trigger({
            type: FIXTURE_EVENTS.test_fail,
            detail: {
              errorType: ERROR_TYPES.unknown_error,
              error: error.toString(),
            },
          })
        }
      }
    }
    const { resolve, promise } = Promise.withResolvers<RunnerMessage>()
    window.__PLAITED__ = {
      reporter: async () => promise,
    }
    return {
      [FIXTURE_EVENTS.run](detail) {
        if (detail.play) {
          trigger({ type: FIXTURE_EVENTS.play, detail })
        } else {
          trigger({ type: FIXTURE_EVENTS.test_pass, detail: '✅ Success' })
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
      [FIXTURE_EVENTS.test_pass]() {
        const { pathname } = new URL(window.location.href)
        resolve({
          type: FIXTURE_EVENTS.test_pass,
          detail: {
            pathname,
          },
        })
      },
      [FIXTURE_EVENTS.test_fail](detail) {
        const { pathname } = new URL(window.location.href)
        resolve({
          type: FIXTURE_EVENTS.test_fail,
          detail: {
            pathname,
            ...detail,
          },
        })
      },
    }
  },
})

const createStoryExport = <T extends FunctionTemplate>(
  { args, template, ...rest }: StoryObj<T>,
  flags: { only?: boolean; skip?: boolean } = {},
): StoryExport<T> => {
  const tpl = template?.(args || {})
  const fixture = StoryFixture({ children: tpl })
  if (rest.play) {
    return {
      ...rest,
      template,
      args,
      type: STORY_TYPES.interaction,
      fixture,
      play: rest.play,
      $: STORY_IDENTIFIER,
      ...flags,
    } as InteractionExport<T>
  }
  return {
    template,
    args,
    description: rest.description,
    parameters: rest.parameters,
    type: STORY_TYPES.snapshot,
    fixture,
    $: STORY_IDENTIFIER,
    ...flags,
  } as SnapshotExport<T>
}

function storyBase<T extends FunctionTemplate>(args: InteractionStoryObj<T>): InteractionExport<T>
function storyBase<T extends FunctionTemplate>(args: SnapshotStoryObj<T>): SnapshotExport<T>
function storyBase<T extends FunctionTemplate>(args: StoryObj<T>): StoryExport<T> {
  return createStoryExport(args)
}

function storyOnly<T extends FunctionTemplate>(args: InteractionStoryObj<T>): InteractionExport<T>
function storyOnly<T extends FunctionTemplate>(args: SnapshotStoryObj<T>): SnapshotExport<T>
function storyOnly<T extends FunctionTemplate>(args: StoryObj<T>): StoryExport<T> {
  return createStoryExport(args, { only: true })
}

function storySkip<T extends FunctionTemplate>(args: InteractionStoryObj<T>): InteractionExport<T>
function storySkip<T extends FunctionTemplate>(args: SnapshotStoryObj<T>): SnapshotExport<T>
function storySkip<T extends FunctionTemplate>(args: StoryObj<T>): StoryExport<T> {
  return createStoryExport(args, { skip: true })
}

const story = Object.assign(storyBase, {
  only: storyOnly,
  skip: storySkip,
})

export { story }
