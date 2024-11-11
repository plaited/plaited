import type { Trigger, Disconnect } from '../behavioral/b-program.js'
import type { ValueOf } from '../utils/value-of.type.js'
import { ACTION_INSERT, ACTION_TRIGGER, INSERT_METHODS } from './client.constants.js'

export type PlaitedTrigger = Trigger & {
  addDisconnectCallback: (disconnect: Disconnect) => void
}

export type Effect = (eventType: string, trigger: Trigger | PlaitedTrigger, getLVC?: boolean) => Disconnect

export type InsertMessage = {
  address: string
  action: typeof ACTION_INSERT
  method: ValueOf<typeof INSERT_METHODS>
  html: string
}

export type JSONDetail = string | number | boolean | null | JsonObject | JsonArray

type JsonObject = {
  [key: string]: JSONDetail
}

type JsonArray = Array<JSONDetail>

export type TriggerMessage<T extends JSONDetail = JSONDetail> = {
  address: string
  action: typeof ACTION_TRIGGER
  type: string
  detail?: T
}

export type PlaitedMessage = InsertMessage | TriggerMessage
