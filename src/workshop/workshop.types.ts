import type { JSONDetail } from '../client/client.types.js'
import type { ServerWebSocket } from 'bun'
import type { TEST_EXCEPTION, UNKNOWN_ERROR, TEST_PASSED } from './workshop.constants.js'

export type MessageDetail<
  T extends { ws: ServerWebSocket<unknown>; message: JSONDetail | undefined } = {
    ws: ServerWebSocket<unknown>
    message: JSONDetail | undefined
  },
> = T

export type FailedTestEvent = {
  address: string
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
  address: string
  type: typeof TEST_PASSED
  detail: {
    route: string
  }
}
