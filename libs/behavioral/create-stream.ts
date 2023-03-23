import { Listener, Stream, StreamMessage } from './types.ts'
export const createStream = (
  initial?: StreamMessage | void,
): Stream => {
  const listeners: Array<(value: StreamMessage) => void> = []
  function createdStream(value: StreamMessage) {
    for (const i in listeners) {
      listeners[i](value)
    }
  }
  createdStream.subscribe = (listener: Listener) => {
    const newInitial = initial !== undefined ? listener(initial) : undefined
    const newStream = createStream(newInitial)
    listeners.push((value: StreamMessage) => {
      value !== undefined && newStream(listener(value) as StreamMessage)
    })

    return newStream
  }
  return createdStream
}
