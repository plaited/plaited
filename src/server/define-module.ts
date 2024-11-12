import type { Server } from 'bun'
import { type BSync, type BThread, bThread, bSync } from '../behavioral/b-thread.js'
import {
  type Actions,
  type UseSnapshot,
  type BThreads,
  type Trigger,
  bProgram,
  type Disconnect,
} from '../behavioral/b-program.js'
import { getPublicTrigger } from '../client/get-public-trigger.js'

type MiddlewareArgs = {
  server: Server
  [key: string]: unknown
}

type BProgramCallback<A extends Actions, T extends MiddlewareArgs> = (
  args: {
    trigger: Trigger
    useSnapshot: UseSnapshot
    bThreads: BThreads
    bThread: BThread
    bSync: BSync
  } & T,
) => A

export const defineModule = <A extends Actions>(id: string, publicEvents: string[] = []) => {
  const disconnectSet = new Set<Disconnect>()
  const { useFeedback, trigger, ...rest } = bProgram()
  return <T extends MiddlewareArgs>(callback: BProgramCallback<A, T>) => {
    const connect = (args: T) => {
      const actions = callback({ ...args, ...rest, trigger, bThread, bSync })
      useFeedback(actions)
    }
    connect.id = id
    connect.disconnect = () => {
      disconnectSet.forEach((disconnect) => disconnect())
      disconnectSet.clear()
    }
    connect.trigger = getPublicTrigger({ trigger, publicEvents, disconnectSet })
    return connect
  }
}
