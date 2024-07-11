import type { BPEvent, Devtool, Actions, Trigger, Thread, Loop, Sync, AddThreads } from '../behavioral/types.js'
import type { Disconnect } from '../component/types.js'

export type UseWorker = {
  (
    scriptURL: string | URL,
    options?: WorkerOptions,
  ): {
    (args: BPEvent): void
    connect(trigger: Trigger): Disconnect
  }
}

export type UsePostMessage = ({
  trigger,
  publicEvents,
  targetOrigin,
}: {
  trigger: Trigger
  publicEvents: string[]
  targetOrigin?: string
}) => {
  (data: BPEvent): void
  disconnect(): void
}

export type DefineWorkerParam = [
  (args: {
    send: ReturnType<UsePostMessage>
    addThreads: AddThreads
    trigger: Trigger
    thread: Thread
    loop: Loop
    sync: Sync
  }) => Actions,
  { devtool?: Devtool; publicEvents: string[]; targetOrigin?: string },
]

export type DefineWorker = (...args: DefineWorkerParam) => void
