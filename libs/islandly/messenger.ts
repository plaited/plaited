import { Trigger, TriggerArgs } from '../behavioral/mod.ts'
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
