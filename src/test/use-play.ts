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

const timeout = async (time: number = DEFAULT_PLAY_TIMEOUT) => {
  await wait(time)
  return true
}

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
  address: string
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
  address: string
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
