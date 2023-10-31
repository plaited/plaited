import { Trigger, TriggerArgs } from '@plaited/behavioral'
import { Connect, Send, Message } from './types.js'
/** Enables communication between agents in a web app.
 * Agents can be Islands, workers, or behavioral program running in the main thread.
 * This allows for execution of the one-way message exchange pattern (aka
 * fire and forget).
 * @returns readonly {}
 *   connect: (recipient: string, trigger: {@link Trigger}) => ()=> void),
 *   send: (recipient: string, detail: {@link TriggerArgs}) => void
 *   worker: (id: string, url: string) =>  ()=> void)
 * }
 */
export const useMessenger = (id?: string) => {
  const recipients = new Set<string>()
  const emitter = new EventTarget()
  /** connect island to messenger */
  const connect: Connect = (recipient: string, trigger: Trigger) => {
    if (recipients.has(recipient)) {
      console.error(
        `A recipient with address [${recipient}] has already connected to this messenger ${id ? `[${id}]` : ''}`,
      )
      return
    }
    recipients.add(recipient)
    const eventHandler = (event: CustomEvent<TriggerArgs>) => trigger(event.detail)
    emitter.addEventListener(recipient, eventHandler as EventListenerOrEventListenerObject)
    return () => {
      recipients.delete(recipient)
      emitter.removeEventListener(recipient, eventHandler as EventListenerOrEventListenerObject)
    }
  }

  /** send request to another island or worker */
  const send = (recipient: string, detail: TriggerArgs) => {
    if (!recipients.has(recipient)) {
      console.error(`No recipient with address [${recipient}] is connected to this messenger ${id ? `[${id}]` : ''}`)
      return
    }
    const event = new CustomEvent(recipient, { detail })
    emitter.dispatchEvent(event)
  }

  connect.worker = (
    /** identifier for our worker */
    recipient: string,
    /** the url of our worker relative to the public directory*/
    worker: Worker,
  ) => {
    const trigger = (args: TriggerArgs) => {
      worker.postMessage(args)
    }
    const disconnect = connect(recipient, trigger)
    if (disconnect) {
      const eventHandler = ({ data }: { data: Message }) => {
        const { recipient, detail } = data
        send(recipient, detail)
      }
      worker.addEventListener('message', eventHandler, false)
      return () => {
        disconnect()
        worker.removeEventListener('message', eventHandler)
      }
    }
  }

  return Object.freeze<{
    connect: Connect
    send: Send
    has: (recipient: string) => boolean
  }>({
    connect,
    send,
    has: (recipient: string) => recipients.has(recipient),
  })
}
