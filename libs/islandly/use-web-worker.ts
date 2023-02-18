import { Trigger, TriggerArgs } from '../behavioral/mod.ts'

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
}: {
  id: string
  url: string
  connect: (recipient: string, trigger: Trigger) => () => void
  send: (recipient: string, detail: TriggerArgs) => void
}): Disconnect => {
  const worker = new Worker(new URL(url, import.meta.url).href, {
    type: 'module',
  })
  const trigger = (args: TriggerArgs) => {
    worker.postMessage(args)
  }
  const disconnect = connect(id, trigger)
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