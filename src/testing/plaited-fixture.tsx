import { css } from '../styling/css'
import { defineElement } from '../main/define-element'
import { h } from '../jsx/create-template.js'
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
  FIXTURE_CONNECTED,
  PLAY_EVENT,
  PLAITED_FIXTURE,
} from './assert.constants.js'
import { AssertionError, MissingTestParamsError } from './errors.js'
import type { StoryObj, Play } from './assert.types.js'
import { wait } from '../utils/wait.js'
import { TimeoutError } from './errors.js'

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
  exportName,
  filePath,
  hostElement,
  route,
  play,
  time,
}: {
  /** The name of the exported story object. */
  exportName: string
  /** The file path of the story. */
  filePath: string
  /** The host element where the story is rendered. */
  hostElement: Element
  /** The route identifier for the story. */
  route: string
  /** The play function to execute. */
  play: Play
  /** Optional timeout duration in milliseconds. */
  time?: number
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
    console.dir({ type: TEST_PASSED, detail: { route } })
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof AssertionError || error instanceof MissingTestParamsError) {
      console.dir({
        type: TEST_EXCEPTION,
        detail: {
          story: exportName,
          file: filePath,
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
      console.dir({
        type: UNKNOWN_ERROR,
        detail: {
          story: exportName,
          file: filePath,
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
 * @element plaited-test-fixture
 * @description A custom element designed to host and execute a single Plaited story test.
 * It receives test parameters via attributes, connects to the test runner via WebSocket
 * loads the specified story module, executes its `play` function (if defined),
 * and reports results or errors back to the runner.
 *
 * @attr {string} p-socket - The WebSocket URL path for communicating with the test runner server.
 * @attr {string} p-route - The unique route identifier for the story being tested.
 * @attr {string} p-file - The original source file path of the story.
 * @attr {string} p-entry - The path to the compiled JavaScript module containing the story export.
 * @attr {string} p-name - The name of the exported story object within the module.
 *
 * @fires play - Dispatched internally to initiate the story's play function execution.
 *
 * @example
 * ```html
 * <plaited-test-fixture
 *   p-socket="/_plaited"
 *   p-route="button--primary"
 *   p-file="src/components/button.stories.ts"
 *   p-entry="/dist/button.stories.js"
 *   p-name="Primary"
 * >
 *   <!-- The rendered story component will be placed here by the test runner -->
 * </plaited-test-fixture>
 * ```
 */
export const PlaitedFixture = defineElement<{
  [PLAY_EVENT](detail: {
    route: string
    filePath: string
    entryPath: string
    exportName: string
    story: StoryObj
  }): void
}>({
  tag: PLAITED_FIXTURE,
  publicEvents: [PLAY_EVENT],
  streamAssociated: true,
  shadowDom: h('slot', {
    ...css.host({
      display: 'contents',
    }),
  }),
  bProgram({ bThreads, host, bThread, bSync }) {
    bThreads.set({
      onPlay: bThread([bSync({ waitFor: PLAY_EVENT }), bSync({ block: PLAY_EVENT })]),
    })
    return {
      async [PLAY_EVENT]({ route, filePath, exportName, story }) {
        try {
          if (story?.play) {
            await playStory({
              play: story.play,
              time: story?.parameters?.timeout,
              route,
              filePath,
              exportName,
              hostElement: host,
            })
          } else {
            console.log('✓', route)
            console.dir({ type: TEST_PASSED, detail: { route } })
          }
        } catch (error) {
          if (error instanceof Error) {
            console.dir({
              type: UNKNOWN_ERROR,
              detail: {
                story: exportName,
                file: filePath,
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
        console.dir({
          type: FIXTURE_CONNECTED,
        })
      },
    }
  },
})
