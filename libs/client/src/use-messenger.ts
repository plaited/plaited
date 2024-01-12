import type { Trigger, BPEvent } from '@plaited/behavioral'
import type { Messenger, PlaitedElement } from '@plaited/types'
import { onlyObservedTriggers } from './only-observed-triggers.js'
/** Enables communication between agents in a web app.
 * Agents can be Islands, or behavioral program running in the main thread.
 * This allows for execution of the one-way message exchange pattern (aka
 * fire and forget).

 */
export const useMessenger = (id?: string): Messenger => {
  const recipients = new Map<string, (evt: BPEvent) => void>()
  /** send BPEvent to another recipient */
  const send = (recipient: string, detail: BPEvent) => {
    if (!recipients.has(recipient)) {
      console.error(`No recipient with address [${recipient}] is connected to this messenger ${id ? `[${id}]` : ''}`)
      return
    }
    return recipients.get(recipient)?.(detail)
  }
  /** connect to messenger */
  send.connect = ({
    recipient,
    trigger,
    observedTriggers,
  }: {
    observedTriggers: string[] | PlaitedElement
    recipient: string
    trigger: Trigger
  }) => {
    if (recipients.has(recipient)) {
      console.error(
        `A recipient with address [${recipient}] has already connected to this messenger ${id ? `[${id}]` : ''}`,
      )
      return
    }
    const _trigger = onlyObservedTriggers(trigger, observedTriggers)
    recipients.set(recipient, (event: BPEvent) => _trigger(event))
    return () => recipients.delete(recipient)
  }
  send.has = (recipient: string) => recipients.has(recipient)
  send.type = 'messenger' as const
  return send
}
