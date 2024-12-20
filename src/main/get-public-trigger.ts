import type { Trigger, Disconnect } from '../behavioral/b-program.js'
import type { PlaitedTrigger } from './plaited.types.js'

export const getPublicTrigger = (args: {
  trigger: Trigger
  publicEvents?: string[] | ReadonlyArray<string>
  disconnectSet?: Set<Disconnect>
}) => {
  const observed = new Set(args?.publicEvents || [])
  const trigger: PlaitedTrigger = ({ type, detail }) => {
    if (observed.has(type)) return args.trigger?.({ type: type, detail: detail })
    if (type) console.warn(`Not observing trigger [${type}]`)
  }
  trigger.addDisconnectCallback = (disconnect: Disconnect) => {
    args.disconnectSet?.add(disconnect)
  }
  return trigger
}
