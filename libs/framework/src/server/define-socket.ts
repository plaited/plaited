// import type { DefineSocketHandler, DefineSocketConfig, ServerWebSocket, DefineSocketReturn } from './types.js'
// import type { BPEvent, Trigger } from '../behavioral/types.js'
// import { bProgram } from '../behavioral/b-program.js'
// import { sync, point } from '../behavioral/sync.js'  
// import { onlyPublicEvents } from '../shared/only-public-events.js'

// export const defineSocket = <T = unknown>(
//   handler: DefineSocketHandler<T>,
//   { publicEvents, address }: DefineSocketConfig,
// ): DefineSocketReturn<T> => {
//   let ctx: T
//   const getContext = () => ctx
//   const setContext = (context: T) => (ctx = context)
//   let trigger: Trigger
//   const open = (ws: ServerWebSocket<T>) => {
//     const { useFeedback, ...rest } = bProgram()
//     trigger = onlyPublicEvents(rest.trigger, publicEvents)
//     setContext(ws.data)
//     const send = (address: string) => (event: BPEvent) => ws.send(JSON.stringify({ address, event }))
//     const actions = handler({ send, getContext, point, sync, trigger, ...rest })
//     useFeedback(actions)
//   }
//   const message = (ws: ServerWebSocket<T>, message: BPEvent) => {
//     setContext(ws.data)
//     trigger(message)
//   }
//   return { address, open, message }
// }
