import { bElement, createHostStyles, type FunctionTemplate, type SnapshotMessage } from '../main.js'
import { wait } from '../utils.js'
import {
  __CLOSE_PLAITED_CONTEXT__,
  __PLAITED_RUNNER__,
  DEFAULT_PLAY_TIMEOUT,
  FIXTURE_EVENTS,
  STORY_FIXTURE,
  STORY_IDENTIFIER,
  STORY_TYPES,
} from './testing.constants.js'
import type {
  InteractionExport,
  InteractionStoryObj,
  Play,
  SnapshotExport,
  SnapshotStoryObj,
  StoryExport,
  StoryObj,
  TestFailureEventDetail,
} from './testing.types.js'
import {
  AccessibilityError,
  FailedAssertionError,
  MissingAssertionParameterError,
  match,
  throws,
  useAccessibilityCheck,
  useAssert,
  useFindByAttribute,
  useFindByTarget,
  useFindByTestId,
  useFindByText,
  useFireEvent,
  useRunner,
  useWait,
} from './testing.utils.js'

declare global {
  interface Window {
    /**
     * @internal
     * Global flag indicating if the current context is within the Plaited test runner environment.
     * This helps conditional logic, like snapshot reporting, to behave differently when running
     * inside the test runner versus a standard browser environment.
     */
    [__PLAITED_RUNNER__]?: boolean
    [__CLOSE_PLAITED_CONTEXT__]?: () => void
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
  [FIXTURE_EVENTS.run]: { play?: InteractionStoryObj['play']; timeout?: number }
  [FIXTURE_EVENTS.play]: { play: InteractionStoryObj['play']; timeout?: number }
  [FIXTURE_EVENTS.close]: undefined
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
            request: { type: FIXTURE_EVENTS.close },
          }),
        ],
        true,
      ),
      onSuccess: bThread(
        [
          bSync({
            waitFor: FIXTURE_EVENTS.run_complete,
          }),
          bSync({
            request: { type: FIXTURE_EVENTS.close },
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
      [FIXTURE_EVENTS.close]() {
        window.__CLOSE_PLAITED_CONTEXT__?.()
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
