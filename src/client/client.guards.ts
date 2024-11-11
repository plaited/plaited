import type { Trigger } from '../behavioral/b-program.js'
import type { PlaitedTrigger, InsertMessage, PlaitedMessage, TriggerMessage } from './client.types'
import { ACTION_INSERT, ACTION_TRIGGER, INSERT_METHODS } from './client.constants.js'
import { isTypeOf } from '../utils/is-type-of.js'

export const isPlaitedTrigger = (trigger: Trigger): trigger is PlaitedTrigger => 'addDisconnectCallback' in trigger

export const isInsertMessage = (msg: unknown): msg is InsertMessage => {
  return (
    isTypeOf<{ [key: string]: unknown }>(msg, 'object') &&
    msg?.action === ACTION_INSERT &&
    isTypeOf<string>(msg?.address, 'string') &&
    isTypeOf<string>(msg?.html, 'string') &&
    isTypeOf<string>(msg?.method, 'string') &&
    msg?.method in INSERT_METHODS
  )
}

export const isTriggerMessage = (msg: unknown): msg is TriggerMessage => {
  return (
    isTypeOf<{ [key: string]: unknown }>(msg, 'object') &&
    msg?.action === ACTION_TRIGGER &&
    isTypeOf<string>(msg?.address, 'string') &&
    isTypeOf<string>(msg?.type, 'string')
  )
}

export const isPlaitedMessage = (msg: unknown): msg is PlaitedMessage => {
  return isTypeOf<{ [key: string]: unknown }>(msg, 'object') && isTypeOf<string>(msg?.address, 'string')
}
