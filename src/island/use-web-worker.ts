import { TriggerArgs, TriggerFunc } from '../plait.ts'

type Message = {
  recipient: string
  detail: TriggerArgs
}

type Disconnect = () => void

export const useWebWorker = ({
  id,
  url,
  connect,
  send,
}:{
  id: string
  url: string
  connect: (recipient: string, cb: TriggerFunc) => () => void
  send: (recipient: string, detail: TriggerArgs) => void
}): Disconnect => {
  const worker = new Worker(new URL(url, import.meta.url).href, { type: 'module' })
  const cb = (args: TriggerArgs) => {
    worker.postMessage(args)
  }
  const disconnect = connect(id, cb)
  const eventHandler = ({ data }: { data: Message }) => {
    const { recipient, detail } = data
    send(recipient, detail)
  }
  worker.addEventListener('message', eventHandler, false)
  return () => {
    disconnect()
    worker.removeEventListener('message', eventHandler)
  }
}
