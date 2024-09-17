import { css, defineTemplate, SendServer } from 'plaited'
import { wait } from '../utils.js'
import { assert } from '../assert/assert.js'
import { findByAttribute } from '../assert/find-by-attribute.js'
import { findByText } from '../assert/find-by-text.js'
import { fireEvent } from '../assert/fire-event.js'
import { match } from '../assert/match.js'
import { throws } from '../assert/throws.js'
import { TimeoutError, AssertionError, MissingTestParamsError } from '../assert/errors.js'
import { TEST_PASSED, TEST_EXCEPTION, DEFAULT_PLAY_TIMEOUT, UNKNOWN_ERROR } from '../assert/assert.constants.js'
import { StoryObj } from './workshop.types.js'
import { USE_PAY_TAG, PLAY_EVENT } from './workshop.constants.js'

export type FailedTest = {
  id: string
  filePath: string
  exportName: string
  location: string
  type: string
  error: string
}

export type PassedTest = {
  id: string
}

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
  filePath: string
  hostElement: Element
  id: string
  play: Play
  time?: number
  send: SendServer
}) => Promise<void>

const timeout = async (time: number = DEFAULT_PLAY_TIMEOUT) => {
  await wait(time)
  return true
}

const usePlay: UsePlay = async ({ exportName, filePath, hostElement, id, play, time, send }) => {
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
    if (timedOut) throw new TimeoutError(`Story ${id} exceeded timeout of ${time} ms`)
    send<PassedTest>({ type: TEST_PASSED, detail: { id } })
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof AssertionError || error instanceof MissingTestParamsError)
      return send<FailedTest>({
        type: TEST_EXCEPTION,
        detail: {
          exportName,
          error: error.toString(),
          filePath,
          id,
          location: window?.location.href,
          type: error.name,
        },
      })
    if (error instanceof Error)
      return send<FailedTest>({
        type: UNKNOWN_ERROR,
        detail: {
          exportName,
          error: error.toString(),
          filePath,
          id,
          location: window?.location.href,
          type: TEST_EXCEPTION,
        },
      })
  }
}

export const UsePlay = defineTemplate({
  tag: USE_PAY_TAG,
  publicEvents: [PLAY_EVENT],
  shadowDom: (
    <slot
      {...css.host({
        display: 'contents',
      })}
    ></slot>
  ),
  connectedCallback({ send, root }) {
    return {
      async [PLAY_EVENT]({ exportName, filePath, id }: { exportName: string; filePath: string; id: string }) {
        const { [exportName]: story } = (await import(filePath)) as { [key: string]: StoryObj }
        try {
          story?.play &&
            (await usePlay({
              play: story.play,
              id,
              time: story?.parameters?.timeout,
              send: send.server,
              filePath,
              exportName,
              hostElement: root.host,
            }))
        } catch (error) {
          if (error instanceof Error)
            return send.server<FailedTest>({
              type: UNKNOWN_ERROR,
              detail: {
                exportName,
                filePath,
                id,
                location: window?.location.href,
                type: TEST_EXCEPTION,
                error: error.toString(),
              },
            })
        }
      },
    }
  },
})
