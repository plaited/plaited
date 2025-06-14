import { assert } from './assert.js'
import { findByAttribute } from './find-by-attribute.js'
import { findByText } from './find-by-text.js'
import { fireEvent } from './fire-event.js'
import { match } from './match.js'
import { throws } from './throws.js'
import {
  ASSERTION_ERROR,
  MISSING_TEST_PARAMS_ERROR,
  TEST_PASSED,
  TEST_EXCEPTION,
  UNKNOWN_ERROR,
  TIMEOUT_ERROR,
  DEFAULT_PLAY_TIMEOUT,
  PLAY_EVENT,
  FIXTURE_CONNECTED,
} from './assert.constants.js'
import { AssertionError, MissingTestParamsError } from './errors.js'
import type { StoryObj, Play } from './assert.types.js'
import { wait } from '../utils/wait.js'
import { TimeoutError } from './errors.js'
import type { PlaitedMessage, PlaitedElement } from '../main/plaited.types.js'
import { bSync, bThread } from '../behavioral/b-thread.js'
import type { BThreads } from '../behavioral/b-program.js'

/**
 * Creates a promise that resolves after a specified time, used for implementing timeouts.
 * @param time The timeout duration in milliseconds. Defaults to DEFAULT_PLAY_TIMEOUT.
 * @returns A promise that resolves to true after the timeout.
 * @internal
 */
const timeout = async (time: number = DEFAULT_PLAY_TIMEOUT) => {
  await wait(time)
  return true
}

/**
 * Executes the play function of a story, handling timeouts and error reporting.
 * @param options Configuration object for playing the story.
 * @internal
 */
const playStory = async ({
  address,
  exportName,
  storyFile,
  hostElement,
  route,
  play,
  time,
  send,
}: {
  /** The address of the test runner to send messages to. */
  address: string
  /** The name of the exported story object. */
  exportName: string
  /** The file path of the story. */
  storyFile: string
  /** The host element where the story is rendered. */
  hostElement: Element
  /** The route identifier for the story. */
  route: string
  /** The play function to execute. */
  play: Play
  /** Optional timeout duration in milliseconds. */
  time?: number
  /** Function to send messages back to the test runner. */
  send: (message: PlaitedMessage) => void
}) => {
  try {
    const timedOut = await Promise.race([
      play({
        assert,
        findByAttribute,
        findByText,
        fireEvent,
        hostElement,
        match,
        throws,
        wait,
      }),
      timeout(time),
    ])
    if (timedOut) throw new TimeoutError(`Story [${route}] exceeded timeout of ${time} ms`)
    send({ address, type: TEST_PASSED, detail: { route } })
    console.log('✓ ', route)
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof AssertionError || error instanceof MissingTestParamsError) {
      send({
        address,
        type: TEST_EXCEPTION,
        detail: {
          story: exportName,
          file: storyFile,
          route,
          url: window?.location.href,
          type:
            error instanceof AssertionError ? ASSERTION_ERROR
            : error instanceof TimeoutError ? TIMEOUT_ERROR
            : MISSING_TEST_PARAMS_ERROR,
        },
      })
      throw error
    }
    if (error instanceof Error) {
      send({
        address,
        type: UNKNOWN_ERROR,
        detail: {
          story: exportName,
          file: storyFile,
          route,
          url: window?.location.href,
          type: UNKNOWN_ERROR,
        },
      })
      throw error
    }
  }
}

/**
 * Creates a behavioral program configuration for executing a story's play function
 * within a Plaited testing fixture. It handles importing the story, running the
 * play function with appropriate context and utilities, managing timeouts, and
 * reporting results or errors back to the test runner via a messaging channel.
 *
 * @param options Configuration object for the play hook.
 * @returns An object containing event handlers (`[PLAY_EVENT]`, `onConnected`) for the bProgram.
 *
 * @example
 * ```ts
 * // Used internally by PlaitedFixture
 * const bProgramConfig = usePlay({
 *   address: 'PLAITED_RUNNER',
 *   entryPath: '/path/to/story.stories.js',
 *   exportName: 'Primary',
 *   host: fixtureElement,
 *   route: 'component--primary',
 *   send: sendMessageToRunner,
 *   storyFile: 'path/to/story.stories.ts',
 *   bThreads: bProgramInstance.bThreads,
 * });
 * ```
 */
export const usePlay = ({
  address,
  entryPath,
  exportName,
  host,
  route,
  send,
  storyFile,
  bThreads,
}: {
  /** The address identifier for the test runner (e.g., PLAITED_RUNNER). */
  address: string
  /** The path to the compiled story module file. */
  entryPath: string
  /** The name of the exported story object within the module. */
  exportName: string
  /** The PlaitedElement instance hosting the fixture. */
  host: PlaitedElement
  /** The unique route identifier for this story test. */
  route: string
  /** Function to send messages (test results/errors) back to the test runner. */
  send: (message: PlaitedMessage) => void
  /** The original source file path of the story. */
  storyFile: string
  /** The BThreads instance from the host's bProgram. */
  bThreads: BThreads
}) => {
  bThreads.set({
    onPlay: bThread([bSync({ waitFor: PLAY_EVENT }), bSync({ block: PLAY_EVENT })]),
  })
  return {
    async [PLAY_EVENT]() {
      const { [exportName]: story } = (await import(entryPath)) as {
        [key: string]: StoryObj
      }
      try {
        if (story?.play) {
          await playStory({
            address,
            play: story.play,
            time: story?.parameters?.timeout,
            send,
            route,
            storyFile,
            exportName,
            hostElement: host,
          })
        } else {
          console.log('✓', route)
          send({ address, type: TEST_PASSED, detail: { route } })
        }
      } catch (error) {
        if (error instanceof Error) {
          send({
            address,
            type: UNKNOWN_ERROR,
            detail: {
              story: exportName,
              file: storyFile,
              route,
              url: window?.location.href,
              type: UNKNOWN_ERROR,
            },
          })
          throw error
        }
      }
    },
    onConnected() {
      send({
        address,
        type: FIXTURE_CONNECTED,
      })
    },
  }
}
