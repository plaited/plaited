import { TriggerArgs, TriggerFunc } from '@plaited/plait'
type Message = {
  recipient: string
  detail: TriggerArgs
}
export const worker = (url: string) => {
  const listeners = new Map()
  const worker = new Worker(url, { type: 'module' })
  const eventHandler = ({ data }: { data: Message }) => {
    const { recipient, detail } = data
    const cb = listeners.get(recipient)
    cb(detail)
  }
  const connect = (recipient: string, cb: TriggerFunc) => {
    listeners.set(recipient, cb)
    worker.addEventListener('message', eventHandler, false)
    return () => listeners.delete(recipient)
  }
  const send = (recipient: string, detail: TriggerArgs) => {
    worker.postMessage({ recipient, detail })
  }
  return Object.freeze({ connect, send })
}
