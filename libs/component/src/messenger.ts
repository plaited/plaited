import type { Trigger, TriggerArgs } from '@plaited/behavioral'
import type { Message, Messenger } from '../../types/dist/index.js'
/** Enables communication between agents in a web app.
 * Agents can be Islands, workers, or behavioral program running in the main thread.
 * This allows for execution of the one-way message exchange pattern (aka
 * fire and forget).

 */

const isWorker = (trigger: Trigger | Worker): trigger is Worker => trigger instanceof Worker
export const messenger = (id?: string): Messenger => {
  const recipients = new Set<string>()
  const emitter = new EventTarget()
  /** createMessenger request to another island or worker */
  const createMessenger = (recipient: string, detail: TriggerArgs) => {
    if (!recipients.has(recipient)) {
      console.error(`No recipient with address [${recipient}] is connected to this messenger ${id ? `[${id}]` : ''}`)
      return
    }
    const event = new CustomEvent(recipient, { detail })
    emitter.dispatchEvent(event)
  }
  /** connect web worker to messenger */
  const worker = (
    /** the url of our worker relative to the public directory*/
    worker: Worker,
  ) => {
    const triggerWorker = (args: TriggerArgs) => {
      worker.postMessage(args)
    }
    const eventHandler = ({ data }: { data: Message }) => {
      const { recipient, detail } = data
      createMessenger(recipient, detail)
    }
    worker.addEventListener('message', eventHandler, false)
    const disconnectWorker = () => {
      return () => {
        worker.removeEventListener('message', eventHandler)
      }
    }
    return { triggerWorker, disconnectWorker }
  }
  /** connect to messenger */
  createMessenger.connect = (recipient: string, trigger: Trigger | Worker) => {
    if (recipients.has(recipient)) {
      console.error(
        `A recipient with address [${recipient}] has already connected to this messenger ${id ? `[${id}]` : ''}`,
      )
      return
    }
    recipients.add(recipient)
    const hasWorker = isWorker(trigger)
    let triggerWorker: Trigger
    let disconnectWorker: () => void
    if (hasWorker) {
      ;({ triggerWorker, disconnectWorker } = worker(trigger))
    }
    const eventHandler = (event: CustomEvent<TriggerArgs>) =>
      hasWorker ? triggerWorker(event.detail) : trigger(event.detail)
    emitter.addEventListener(recipient, eventHandler as EventListenerOrEventListenerObject)
    return () => {
      recipients.delete(recipient)
      hasWorker && disconnectWorker()
      emitter.removeEventListener(recipient, eventHandler as EventListenerOrEventListenerObject)
    }
  }
  createMessenger.has = (recipient: string) => recipients.has(recipient)
  return createMessenger
}
