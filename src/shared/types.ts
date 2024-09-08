import type { Trigger } from '../behavioral.js'
import type { ValueOf } from '../utils.js'
import { ACTION_INSERT, INSERT_METHODS, ACTION_TRIGGER } from './constants.js'

export type Disconnect = () => void

export type SubscribeToPublisher = (eventType: string, trigger: Trigger, getLVC?: boolean) => Disconnect


export type InsertMethods = 'replaceChildren' | 'prepend' | 'append'

export type InsertMessage = {
  address: string
  action: typeof ACTION_INSERT
  method: ValueOf<typeof INSERT_METHODS>
  html: string
}

export type TriggerMessageDetail = string | number | boolean | null | JsonObject | JsonArray

interface JsonObject {
  [key: string]: TriggerMessageDetail
}

interface JsonArray extends Array<TriggerMessageDetail> {}

export type TriggerMessage<T extends TriggerMessageDetail = TriggerMessageDetail> = {
  address: string
  action: typeof ACTION_TRIGGER
  type: string
  detail?: T
}
