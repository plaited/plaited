export const stream = initial => {
  const listeners = []
  function createdStream(value) {
    for (const i in listeners) {
      listeners[i](value)
    }
  }
  createdStream.subscribe = listener => {
    const newInitial = initial !== undefined ? listener(initial) : undefined
    const newStream = stream(newInitial)
    listeners.push(value => {
      value !== undefined && newStream(listener(value))
    })
    return newStream
  }
  return createdStream
}
