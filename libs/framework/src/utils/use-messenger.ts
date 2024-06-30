import { noop } from '@plaited/utils'
import type { UseMessenger, Trigger, BPEvent, Message } from '../types.js'
import { onlyObservedTriggers } from '../shared/only-observed-triggers.js'

/** Enables communication between agents in a web app.
 * Agents can be Islands, or behavioral program running in the main thread.
 * This allows for execution of the one-way message exchange pattern (aka
 * fire and forget).

 */

export const useMessenger: UseMessenger = () => {
  const contacts = new Map<string, (evt: BPEvent) => void>()
  const hasRecipient = (address: string) => {
    if (!contacts.has(address)) {
      console.error(`No recipient with address [${address}] is connected to this messenger`)
      return false
    }
    return true
  }
  const connect = ({
    trigger,
    observedTriggers,
    address,
  }: {
    trigger: Trigger
    observedTriggers: string[]
    address: string
  }) => {
    if (contacts.has(address)) {
      console.error(`A recipient with address [${address}] has already connected to this messenger`)
      return noop
    }
    const _trigger = onlyObservedTriggers(trigger, observedTriggers)
    contacts.set(address, _trigger)
    return () => {
      contacts.delete(address)
    }
  }
  const send = ({ event, address }: Message) => {
    hasRecipient(address) && contacts.get(address)?.(event)
  }
  send.connect = connect
  send.type = 'messenger' as const
  send.has = (address: string) => contacts.has(address)
  return send
}
