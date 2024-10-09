import type { ServerWebSocket } from 'bun'
import { type BSync, type BThread, bThread, bSync } from '../behavioral/b-thread.ts'
import {
  type Actions,
  type UseSnapshot,
  type BThreads,
  type Trigger,
  bProgram,
  type Disconnect,
} from '../behavioral/b-program.ts'
import { usePublicEvents } from '../client/use-public-events.ts'
import type { PlaitedTrigger } from '../client/client.types.ts'

export const defineModule = <A extends Actions, W = unknown>({
  id,
  publicEvents = [],
  connectedCallback,
}: {
  id: string
  publicEvents?: string[]
  connectedCallback: (args: {
    ws: ServerWebSocket<W>
    trigger: Trigger
    useSnapshot: UseSnapshot
    bThreads: BThreads
    bThread: BThread
    bSync: BSync
  }) => A
}): {
  (ws: ServerWebSocket<W>): PlaitedTrigger
  id: string
  disconnect(): void
} => {
  const disconnectSet = new Set<Disconnect>()
  const { useFeedback, trigger, ...rest } = bProgram()
  const connect = (ws: ServerWebSocket<W>) => {
    const actions = connectedCallback({ trigger, bThread, bSync, ws, ...rest })
    useFeedback(actions)
    return usePublicEvents({ trigger, publicEvents, disconnectSet })
  }
  connect.id = id
  connect.disconnect = () => {
    disconnectSet.forEach((disconnect) => disconnect())
    disconnectSet.clear()
  }
  return connect
}
