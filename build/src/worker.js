export const workerMessenger = url => {
  const listeners = new Map()
  const worker = new Worker(url, {type:'module'})
  const eventHandler = e => listeners.forEach(([, cb]) => cb(e.data))
  const connect = (recipient, cb) => {
    listeners.set(recipient, cb)
    worker.addEventListener('message', eventHandler, false)
    return () => listeners.delete(recipient)
  }
  const send = (recipient, detail) => {
    worker.postMessage(message)
  }
  return Object.freeze({connect, send})
}
