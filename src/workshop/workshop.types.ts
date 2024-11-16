import type { JSONDetail } from '../client/client.types.js'
import type { ServerWebSocket } from 'bun'

export type MessageDetail<
  T extends { ws: ServerWebSocket<unknown>; message: JSONDetail | undefined } = {
    ws: ServerWebSocket<unknown>
    message: JSONDetail | undefined
  },
> = T
