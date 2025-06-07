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
  FAILED_ASSERTION,
  MISSING_ASSERTION_PARAMETER,
  TEST_PASSED,
  UNKNOWN_ERROR,
  FIXTURE_CONNECTED,
  PLAY_EVENT,
  PLAITED_FIXTURE,
} from './assert.constants.js'
import { FailedAssertionError, MissingAssertionParameterError } from './errors.js'
import type { InteractionStoryObj, SnapshotStoryObj } from './assert.types.js'
import { wait } from '../utils/wait.js'

type InteractionDetail = {
  route: string
  filePath: string
  entryPath: string
  exportName: string
  story: InteractionStoryObj
}

type SnapshotDetail = {
  route: string
  filePath: string
  entryPath: string
  exportName: string
  story: SnapshotStoryObj
}

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
  [PLAY_EVENT](detail: InteractionDetail): void
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
      onPlay: bThread([
        bSync<InteractionDetail | SnapshotDetail>({
          waitFor: PLAY_EVENT,
          block: ({ type, detail }) => {
            if (type !== PLAY_EVENT) return true
            const { story } = detail
            return !Object.hasOwn(story, 'play')
          },
        }),
        bSync({ block: PLAY_EVENT }),
      ]),
    })
    return {
      async [PLAY_EVENT]({ route, filePath, exportName, story }) {
        const { play } = story
        try {
          await play({
            assert,
            findByAttribute,
            findByText,
            fireEvent,
            hostElement: host,
            match,
            throws,
            wait,
          })
          console.dir({ type: TEST_PASSED, detail: { route } })
        } catch (error) {
          console.log(error)
          if (error instanceof FailedAssertionError || error instanceof MissingAssertionParameterError) {
            console.dir({
              type: error instanceof FailedAssertionError ? FAILED_ASSERTION : MISSING_ASSERTION_PARAMETER,
              detail: {
                message: error.message,
                story: exportName,
                file: filePath,
                route,
                url: window?.location.href,
                trace: getTraceOnly(error.stack ?? 'no trace'),
              },
            })
          } else if (error instanceof Error) {
            console.dir({
              type: UNKNOWN_ERROR,
              detail: {
                name: error?.name,
                message: error?.message,
                trace: getTraceOnly(error.stack ?? 'no trace'),
                cause: error?.cause,
                story: exportName,
                file: filePath,
                route,
                url: window?.location.href,
              },
            })
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
if (import.meta.hot) {
  console.log('hot')
}
