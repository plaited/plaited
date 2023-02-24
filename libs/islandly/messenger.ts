import { Trigger, TriggerArgs } from '../behavioral/mod.ts'
/** Enables communication between actors in a web app.
 * Actors can be Islands, workers, or bPrograms running in the main thread
 * @returns two function a connect function to connect an actor and send function
 * to send a message to an actor
 */
export const messenger = () => {
  const emitter = new EventTarget()

  const connect = (recipient: string, trigger: Trigger) => {
    const eventHandler = (event: CustomEvent<TriggerArgs>) =>
      trigger(event.detail)
    emitter.addEventListener(
      recipient,
      eventHandler as EventListenerOrEventListenerObject,
    )
    return () =>
      emitter.removeEventListener(
        recipient,
        eventHandler as EventListenerOrEventListenerObject,
      )
  }

  const send = (recipient: string, detail: TriggerArgs) => {
    const event = new CustomEvent(recipient, { detail })
    emitter.dispatchEvent(event)
  }
  return Object.freeze({ connect, send })
}
