import { assert } from './assert.js'
import { findByAttribute } from './find-by-attribute.js'
import { findByText } from './find-by-text.js'
import { fireEvent } from './fire-event.js'
import { match } from './match.js'
import { throws } from './throws.js'
import { wait } from '../utils/wait.js'
import { TimeoutError, AssertionError, MissingTestParamsError } from './errors.js'
import { TEST_PASSED, TEST_EXCEPTION, DEFAULT_PLAY_TIMEOUT } from './constants.js'
import { send, sendUnknownError, FailedTest, PassedTest } from './send.js'

export type Play = (args: {
  assert: typeof assert
  findByAttribute: typeof findByAttribute
  findByText: typeof findByText
  fireEvent: typeof fireEvent
  match: typeof match
  throws: typeof throws
  wait: typeof wait
}) => Promise<void>

type UsePlay = (arg:{ play: Play, time?: number, id: string }) => Promise<void>

const timeout = async (time: number = DEFAULT_PLAY_TIMEOUT) => {
  await wait(time)
  return true
}

export const usePlay:UsePlay = async ({play, time, id}) => {
  try {
    const timedOut = await Promise.race([
      play({
        assert,
        findByAttribute,
        findByText,
        fireEvent,
        match,
        throws,
        wait,
      }),
      timeout(time),
    ])
    if (timedOut) throw new TimeoutError(`Story ${id} exceeded timeout of ${time} ms`)
    send<PassedTest>({ type: TEST_PASSED, detail: { id }})
  } catch (error) {
    if(
      error instanceof TimeoutError ||
      error instanceof AssertionError ||
      error instanceof MissingTestParamsError
    ) return send<FailedTest>({ 
      type: TEST_EXCEPTION, 
      detail: {
        id,
        type: error.name,
        location: window?.location.href,
        error: error.toString(),
      }
    })
    if(error instanceof Error) return sendUnknownError(id, error)
  }
}
