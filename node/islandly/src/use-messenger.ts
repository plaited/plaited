import { Trigger, TriggerArgs } from '@plaited/behavioral'
import { Disconnect } from './types.js'

interface Connect {
  (recipient: string, trigger: Trigger): Disconnect
  worker: (id: string, worker: Worker) => Disconnect
}
type Send = (recipient: string, detail: TriggerArgs) => void
type Message = {
  recipient: string
  detail: TriggerArgs
}

/** Enables communication between agents in a web app.
 * Agents can be Islands, workers, or behavioral program running in the main thread.
 * This allows for execution of the one-way message exchange pattern (aka
 * fire and forget).
 * @returns readonly {}
 *   connect: (recipient: string, trigger: {@link Trigger}) => {@link Disconnect},
 *   send: (recipient: string, detail: {@link TriggerArgs}) => void
 *   worker: (id: string, url: string) =>  {@link Disconnect}
 * }
 */
export const useMessenger = () => {
  const emitter = new EventTarget()
  /** connect island to messenger */
  const connect = (recipient: string, trigger: Trigger) => {
    const eventHandler = (event: CustomEvent<TriggerArgs>) =>
      trigger(event.detail)
    emitter.addEventListener(
      recipient,
      eventHandler as EventListenerOrEventListenerObject
    )
    return () =>
      emitter.removeEventListener(
        recipient,
        eventHandler as EventListenerOrEventListenerObject
      )
  }

  connect.worker = (
    /** identifier for our worker */
    recipient: string,
    /** the url of our worker relative to the public directory*/
    worker: Worker
  ) => {
    const trigger = (args: TriggerArgs) => {
      worker.postMessage(args)
    }
    const disconnect = connect(recipient, trigger)
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

  /** send request to another island or worker */
  const send = (recipient: string, detail: TriggerArgs) => {
    const event = new CustomEvent(recipient, { detail })
    emitter.dispatchEvent(event)
  }
  return Object.freeze<
    [Connect, Send]
  >([
    connect,
    send,
  ])
}
