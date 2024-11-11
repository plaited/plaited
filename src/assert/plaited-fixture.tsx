import { assert } from './assert.js'
import { findByAttribute } from './find-by-attribute.js'
import { findByText } from './find-by-text.js'
import { fireEvent } from './fire-event.js'
import { match } from './match.js'
import { throws } from './throws.js'
import {
  TEST_PASSED,
  TEST_EXCEPTION,
  UNKNOWN_ERROR,
  ASSERTION_ERROR,
  MISSING_TEST_PARAMS_ERROR,
  TIMEOUT_ERROR,
  DEFAULT_PLAY_TIMEOUT,
  PLAY_EVENT,
  PLAITED_FIXTURE,
} from './assert.constants.js'
import { TimeoutError, AssertionError, MissingTestParamsError } from './errors.js'
import { css } from '../style/css.js'
import { defineTemplate } from '../client/define-template.js'
import { useServer } from '../client/use-server.js'
import { wait } from '../utils/wait.js'
import type { StoryObj, FailedTestEvent, PassedTestEvent } from './assert.types.js'

export type Play = (args: {
  assert: typeof assert
  findByAttribute: typeof findByAttribute
  findByText: typeof findByText
  fireEvent: typeof fireEvent
  hostElement: Element
  match: typeof match
  throws: typeof throws
  wait: typeof wait
}) => Promise<void>

type UsePlay = (arg: {
  exportName: string
  storyFile: string
  hostElement: Element
  play: Play
  route: string
  send: ReturnType<typeof useServer>
  time?: number
}) => Promise<void>

const timeout = async (time: number = DEFAULT_PLAY_TIMEOUT) => {
  await wait(time)
  return true
}

const usePlay: UsePlay = async ({ exportName, storyFile, hostElement, route, play, time, send }) => {
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
    send<PassedTestEvent['detail']>({ type: TEST_PASSED, detail: { route } })
    console.log('✓ ', route)
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof AssertionError || error instanceof MissingTestParamsError) {
      send<FailedTestEvent['detail']>({
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
      send<FailedTestEvent['detail']>({
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

export const PlaitedFixture = defineTemplate({
  tag: PLAITED_FIXTURE,
  publicEvents: [PLAY_EVENT],
  shadowDom: (
    <slot
      {...css.host({
        display: 'block',
      })}
    ></slot>
  ),
  bProgram({ root, bThreads, bThread, bSync }) {
    const send = useServer({ url: this.getAttribute('p-socket') as `/${string}` })
    send.connect(this)
    const route = this.getAttribute('p-route') as string
    const storyFile = this.getAttribute('p-file') as string
    const entryPath = this.getAttribute('p-entry') as string
    const exportName = this.getAttribute('p-name') as string
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
            await usePlay({
              play: story.play,
              time: story?.parameters?.timeout,
              send,
              route,
              storyFile,
              exportName,
              hostElement: root.host,
            })
          } else {
            console.log('✓', route)
            send<PassedTestEvent['detail']>({ type: TEST_PASSED, detail: { route } })
          }
        } catch (error) {
          if (error instanceof Error) {
            send<FailedTestEvent['detail']>({
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
    }
  },
})
