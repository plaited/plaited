import { css } from '../css/css.js'
import { defineTemplate } from '../client/define-template.js'
import { wait } from '../utils/wait.js'
import { assert } from '../assert/assert.js'
import { findByAttribute } from '../assert/find-by-attribute.js'
import { findByText } from '../assert/find-by-text.js'
import { fireEvent } from '../assert/fire-event.js'
import { match } from '../assert/match.js'
import { throws } from '../assert/throws.js'
import { TimeoutError, AssertionError, MissingTestParamsError } from '../assert/errors.js'
import {
  TEST_PASSED,
  TEST_EXCEPTION,
  UNKNOWN_ERROR,
  ASSERTION_ERROR,
  MISSING_TEST_PARAMS_ERROR,
  TIMEOUT_ERROR,
} from '../assert/assert.constants.js'
import type { StoryObj } from './workshop.types.js'
import { useServer } from '../client/use-server.js'

export const DEFAULT_PLAY_TIMEOUT = 5_000
export const PLAY_EVENT = 'play'
export const PLAITED_FIXTURE = 'plaited-test-fixture'

export type FailedTestEvent = {
  type: typeof TEST_EXCEPTION | typeof UNKNOWN_ERROR
  detail: {
    route: string
    file: string
    story: string
    url: string
    type: string
  }
}

export type PassedTestEvent = {
  type: typeof TEST_PASSED
  detail: {
    route: string
  }
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
  send: ReturnType<typeof useServer>
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
    send<PassedTestEvent['detail']>({ type: TEST_PASSED, detail: { route } })
    console.log('✓ ', route)
  } catch (error) {
    if (error instanceof TimeoutError || error instanceof AssertionError || error instanceof MissingTestParamsError) {
      send<FailedTestEvent['detail']>({
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
      send<FailedTestEvent['detail']>({
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

export const PlaitedFixture = defineTemplate<{
  'p-name': string
  'p-file': string
  'p-route': string
  'p-socket': `/${string}`
}>({
  tag: PLAITED_FIXTURE,
  publicEvents: [PLAY_EVENT],
  shadowDom: (
    <slot
      {...css.host({
        display: 'block',
      })}
    ></slot>
  ),
  connectedCallback({ root }) {
    const send = useServer(this.getAttribute('p-socket') as `/${string}`)
    send.connect(this)
    const route = this.getAttribute('p-route') as string
    const filePath = this.getAttribute('p-file') as string
    const exportName = this.getAttribute('p-name') as string
    return {
      async [PLAY_EVENT]() {
        const { [exportName]: story } = (await import(filePath)) as {
          [key: string]: StoryObj
        }
        try {
          if (story?.play) {
            await usePlay({
              play: story.play,
              time: story?.parameters?.timeout,
              send,
              route,
              filePath,
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
    }
  },
})
