import type { Trigger } from '../behavioral/b-program.js'
import type { PlaitedTrigger, PlaitedMessage, PlaitedElement } from './plaited.types'
import { isTypeOf } from '../utils/is-type-of.js'

export const isPlaitedTrigger = (trigger: Trigger): trigger is PlaitedTrigger => 'addDisconnectCallback' in trigger

export const isPlaitedMessage = (msg: unknown): msg is PlaitedMessage => {
  return (
    isTypeOf<{ [key: string]: unknown }>(msg, 'object') &&
    isTypeOf<string>(msg?.address, 'string') &&
    isTypeOf<string>(msg?.type, 'string')
  )
}

export const isPlaitedElement = (el: unknown): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el
