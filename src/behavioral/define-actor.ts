import { type BSync, type BThread, bThread, bSync } from './b-thread.js'
import {
  type EventDetails,
  type UseSnapshot,
  type BThreads,
  bProgram,
  type Disconnect,
  type Handlers,
} from './b-program.js'
import { getPlaitedTrigger, type PlaitedTrigger } from './get-plaited-trigger.js'
import { getPublicTrigger } from './get-public-trigger.js'

export const defineActor = <
  A extends EventDetails,
  C extends { [key: string]: unknown } = { [key: string]: unknown },
>(args: {
  publicEvents?: string[]
  bProgram: (
    args: {
      bSync: BSync
      bThread: BThread
      bThreads: BThreads
      disconnect: Disconnect
      trigger: PlaitedTrigger
      useSnapshot: UseSnapshot
    } & C,
  ) => Handlers<A> | Promise<Handlers<A>>
}) => {
  const { trigger, useFeedback, ...rest } = bProgram()
  const disconnectSet = new Set<Disconnect>()
  const disconnect = () => {
    disconnectSet.forEach((disconnect) => disconnect())
  }
  return async (ctx: C) => {
    const handlers = await args.bProgram({
      ...ctx,
      bSync,
      bThread,
      disconnect,
      trigger: getPlaitedTrigger(trigger, disconnectSet),
      ...rest,
    })
    useFeedback(handlers)
    return getPublicTrigger({ trigger, publicEvents: args?.publicEvents })
  }
}
