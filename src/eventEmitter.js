export const eventEmitter = () => {
  const emitter = new EventTarget()

  const on = (event, cb) => {
    const eventHandler = e => cb(e.detail)
    emitter.addEventListener(event, eventHandler)
    return () => emitter.removeEventListener(event, eventHandler)
  }

  const emit = (event, detail) => {
    const evt = new CustomEvent(event, {detail})
    emitter.dispatchEvent(evt)
  }
  return Object.freeze({on, emit})
}
