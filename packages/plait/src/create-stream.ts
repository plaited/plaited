import { Listener, ListenerMessage, CreatedStream } from './types.js'
export const createStream = (initial?: ListenerMessage | void): CreatedStream => {
  const listeners: Array<(value: ListenerMessage) => void> = []
  function createdStream(value: ListenerMessage) {
    for (const i in listeners) {
      listeners[i](value)
    }
  }
  createdStream.subscribe = (listener: Listener) => {
    const newInitial = initial !== undefined ? listener(initial) : undefined
    const newStream = createStream(newInitial)
    listeners.push((value: ListenerMessage) => {
      value !== undefined && newStream(listener(value) as ListenerMessage)
    })

    return newStream
  }
  return createdStream
}
