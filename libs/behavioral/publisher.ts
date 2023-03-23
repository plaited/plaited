import { Message, Subscriber } from './types.ts'
export const publisher = () => {
  const listeners: Array<(value: Message) => void> = []
  function publication(value: Message) {
    for (const i in listeners) {
      listeners[i](value)
    }
  }
  publication.subscribe = (listener: Subscriber) => {
    listeners.push((value: Message) => {
      value !== undefined && listener(value)
    })
  }
  return publication
}
