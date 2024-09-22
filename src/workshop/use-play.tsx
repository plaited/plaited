import { css } from '../css/css.js'
import { defineTemplate } from '../client/define-template.js'
import type { SendServer } from '../client/use-server.js'
import { wait } from '../utils/wait.js'
import { assert } from '../assert/assert.js'
import { findByAttribute } from '../assert/find-by-attribute.js'
import { findByText } from '../assert/find-by-text.js'
import { fireEvent } from '../assert/fire-event.js'
import { match } from '../assert/match.js'
import { throws } from '../assert/throws.js'
import { TimeoutError, AssertionError, MissingTestParamsError } from '../assert/errors.js'
import { TEST_PASSED, TEST_EXCEPTION, DEFAULT_PLAY_TIMEOUT, UNKNOWN_ERROR } from '../assert/assert.constants.js'
import { StoryObj } from './workshop.types.js'
import { PLAITED_TEXT_FIXTURE, PLAY_EVENT } from './workshop.constants.js'

export type FailedTest = {
  route: string
  filePath: string
  exportName: string
  location: string
  type: string
  error: string
}

export type PassedTest = {
  route: string
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
  play: Play
  route: string
  send: SendServer
  time?: number
}) => Promise<void>

const timeout = async (time: number = DEFAULT_PLAY_TIMEOUT) => {
  await wait(time)
  return true
}

const usePlay: UsePlay = async ({ exportName, filePath, hostElement, route, play, time, send }) => {
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
    send<PassedTest>({ type: TEST_PASSED, detail: { route } })
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof AssertionError || error instanceof MissingTestParamsError)
      return send<FailedTest>({
        type: TEST_EXCEPTION,
        detail: {
          exportName,
          error: error.toString(),
          filePath,
          route,
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
          route,
          location: window?.location.href,
          type: TEST_EXCEPTION,
        },
      })
  }
}

export const UseTestFixture = defineTemplate({
  tag: PLAITED_TEXT_FIXTURE,
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
      async [PLAY_EVENT]({ exportName, filePath, route }: { exportName: string; filePath: string; route: string }) {
        const { [exportName]: story } = (await import(filePath)) as { [key: string]: StoryObj }
        try {
          story?.play &&
            (await usePlay({
              play: story.play,
              time: story?.parameters?.timeout,
              send: send.server,
              route,
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
                route,
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
