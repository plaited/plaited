import type { Trigger, Disconnect } from '../behavioral/b-program.js'

export type PublicTrigger = Trigger & {
  addDisconnectCallback: (disconnect: Disconnect) => void
}

export const getPublicTrigger = (args: {
  trigger: Trigger
  publicEvents?: string[] | ReadonlyArray<string>
  disconnectSet?: Set<Disconnect>
}) => {
  const observed = new Set(args?.publicEvents || [])
  const trigger: PublicTrigger = ({ type, detail }) => {
    if (observed.has(type)) return args.trigger?.({ type: type, detail: detail })
    if (type) console.warn(`Not observing trigger [${type}]`)
  }
  trigger.addDisconnectCallback = (disconnect: Disconnect) => {
    args.disconnectSet?.add(disconnect)
  }
  return trigger
}
