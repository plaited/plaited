import type { DefineSocketHandler, DefineSocketConfig, ServerWebSocket, DefineSocketReturn } from './types.js'
import type { BPEvent, Trigger } from '../behavioral/types.js'
import { bProgram, } from '../behavioral/b-program.js'
import { onlyPublicEvents } from '../shared/only-public-events.js'

export const defineSocket =  <T = unknown>(handler: DefineSocketHandler<T>, { publicEvents, devtool, address }: DefineSocketConfig):DefineSocketReturn<T> => {
  let ctx: T
  const getContext = () => ctx
  const setContext = (context: T) => (ctx = context)
  let trigger: Trigger
  const open = (ws: ServerWebSocket<T>) => {
    const { feedback, ...rest } = bProgram(devtool)
    trigger = onlyPublicEvents(rest.trigger, publicEvents)
    setContext(ws.data)
    const send = (address: string ) => (event: BPEvent) => ws.send(JSON.stringify({ address, event}))
    const actions =  handler({ send, getContext, ...rest })
    feedback(actions)
  }
  const message = (ws:ServerWebSocket<T>, message: BPEvent) => {
    setContext(ws.data)
    trigger(message)
  }
  return [address, { open, message}]
}
