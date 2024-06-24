import { Message } from '../types.js'
import { isTypeOf } from '@plaited/utils'

export const isMessageEvent = (event: MessageEvent | Event): event is MessageEvent => event.type === 'message'

export const isMessage = (msg: unknown): msg is Message<string> => {
  return (
    isTypeOf<{ [key: string]: unknown }>(msg, 'object') &&
    'address' in msg &&
    isTypeOf<string>(msg.address, 'string') &&
    'event' in msg &&
    isTypeOf<{ [key: string]: unknown }>(msg.event, 'object') &&
    'type' in msg.event &&
    isTypeOf<string>(msg.event.type, 'string') &&
    'detail' in msg.event &&
    isTypeOf<string>(msg.event.detail, 'string')
  )
}
