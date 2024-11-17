import { assert } from '../assert/assert.js'
import { findByAttribute } from '../assert/find-by-attribute.js'
import { findByText } from '../assert/find-by-text.js'
import { fireEvent } from '../assert/fire-event.js'
import { match } from '../assert/match.js'
import { throws } from '../assert/throws.js'
import { ASSERTION_ERROR, MISSING_TEST_PARAMS_ERROR } from '../assert/assert.constants.js'
import { AssertionError, MissingTestParamsError } from '../assert/errors.js'
import { TEST_PASSED, TEST_EXCEPTION, UNKNOWN_ERROR, TIMEOUT_ERROR } from './workshop.constants.js'
import type { StoryObj, Play } from './workshop.types.js'
import { wait } from '../utils/wait.js'
import {
  DEFAULT_PLAY_TIMEOUT,
  PLAY_EVENT,
  PLAITED_RUNNER,
  FIXTURE_CONNECTED,
  TimeoutError,
} from './workshop.constants.js'
import type { PlaitedMessage, PlaitedElement } from '../main/plaited.types.js'
import { bSync, bThread } from '../behavioral/b-thread.js'
import type { BThreads } from '../behavioral/b-program.js'

const timeout = async (time: number = DEFAULT_PLAY_TIMEOUT) => {
  await wait(time)
  return true
}

const playStory = async ({
  exportName,
  storyFile,
  hostElement,
  route,
  play,
  time,
  send,
}: {
  exportName: string
  storyFile: string
  hostElement: Element
  play: Play
  route: string
  send: (message: PlaitedMessage) => void
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
    send({ address: PLAITED_RUNNER, type: TEST_PASSED, detail: { route } })
    console.log('✓ ', route)
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof AssertionError || error instanceof MissingTestParamsError) {
      send({
        address: PLAITED_RUNNER,
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
        address: PLAITED_RUNNER,
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

export const usePlay = ({
  entryPath,
  exportName,
  host,
  route,
  send,
  storyFile,
  bThreads,
}: {
  entryPath: string
  exportName: string
  host: PlaitedElement
  route: string
  send: (message: PlaitedMessage) => void
  storyFile: string
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
          send({ address: PLAITED_RUNNER, type: TEST_PASSED, detail: { route } })
        }
      } catch (error) {
        if (error instanceof Error) {
          send({
            address: PLAITED_RUNNER,
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
        address: PLAITED_RUNNER,
        type: FIXTURE_CONNECTED,
      })
    },
  }
}
