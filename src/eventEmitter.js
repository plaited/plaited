export const eventEmitter = () => {
  const emitter = new EventTarget()

  const connect = (recipient, trigger) => {
    const eventHandler = e => trigger(e.detail)
    emitter.addEventListener(recipient, eventHandler)
    return () => emitter.removeEventListener(recipient, eventHandler)
  }

  const send = (recipient, message) => {
    const event = new CustomEvent(recipient, {
      detail: message,
    })
    emitter.dispatchEvent(event)
  }
  return Object.freeze({connect, send})
}
