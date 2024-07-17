import { wait } from '@plaited/utils'
import type { Play } from './types.js'
import { assert } from './assert/assert.js'
import { findByAttribute } from './assert/find-by-attribute.js'
import { findByText } from './assert/find-by-text.js'
import { fireEvent } from './assert/fire-event.js'
import { match } from './assert/match.js'
import { TimeoutError } from './assert/errors.js'
import { throws } from './assert/throws.js'

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
