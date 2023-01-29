import { TriggerArgs, TriggerFunc } from '../plait.ts'

export const useMain = ({
  context,
  trigger,
}:{
  context: Window & typeof globalThis
  trigger: TriggerFunc
}) => {
  const eventHandler = ({ data }: { data: TriggerArgs }) => {
    trigger(data)
  }
  const send = (recipient: string, detail: TriggerArgs) => {
    context.postMessage({
      recipient,
      detail,
    })
  }
  context.addEventListener('message', eventHandler, false)
  const disconnect = () => context.removeEventListener('message', eventHandler)
  return Object.freeze({ send, disconnect })
}
