import { TriggerArgs, TriggerFunc } from '@plaited/plait'
export const messenger = () => {
  const emitter = new EventTarget()

  const connect = (recipient: string, cb: TriggerFunc) => {
    const eventHandler = (event: CustomEvent<TriggerArgs>) => cb(event.detail)
    emitter.addEventListener(recipient, eventHandler as EventListenerOrEventListenerObject)
    return () => emitter.removeEventListener(recipient, eventHandler as EventListenerOrEventListenerObject)
  }

  const send = (recipient: string, detail: TriggerArgs) => {
    const event = new CustomEvent(recipient, { detail })
    emitter.dispatchEvent(event)
  }
  return Object.freeze({ connect, send })
}
