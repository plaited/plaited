export const messenger = () => {
  const emitter = new EventTarget()

  const connect = (recipient, cb) => {
    const eventHandler = event => cb(event.detail)
    emitter.addEventListener(recipient, eventHandler)
    return () => emitter.removeEventListener(recipient, eventHandler)
  }

  const send = (recipient, detail) => {
    const event = new CustomEvent(recipient, {detail})
    emitter.dispatchEvent(event)
  }
  return Object.freeze({connect, send})
}
