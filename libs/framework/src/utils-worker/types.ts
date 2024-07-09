import type {
  BPEvent,
  BProgram,
  Devtool,
  Actions,
  Trigger,
  Thread,
  Loop,
  Sync,
  AddThreads,
} from '../behavioral/types.js'

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
