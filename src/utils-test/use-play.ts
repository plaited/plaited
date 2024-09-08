
import type { Play } from './types.js'
import {wait, assert, findByAttribute, findByText, fireEvent, match, TimeoutError, throws} from '../assert.js'

const timeout = async (time: number = 5_000) => {
  await wait(time)
  throw new TimeoutError(`Exceeded timeout of ${time} ms for a test`)
}

export const usePlay = (play: Play, time?: number) =>
  Promise.race([
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
