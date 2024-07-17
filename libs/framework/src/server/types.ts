import type { BPEvent, Devtool, Actions, Trigger, Thread, Loop, Sync, AddThreads } from '../behavioral/types.js'

export type ServerWebSocket<T = unknown> = Parameters<
  Extract<Parameters<typeof Bun.serve<T>>[0], { websocket: unknown; unix?: never }>['websocket']['message']
>['0']

export type DefineSocketHandler<T> = (args: {
  send:  (address: string ) => (event: BPEvent<string>) => ReturnType<ServerWebSocket['send']>
  addThreads: AddThreads
  trigger: Trigger
  thread: Thread
  loop: Loop
  sync: Sync
  getContext: () => T
}) => Actions

export type DefineSocketConfig = { devtool?: Devtool; publicEvents: string[]; address: string }


export type DefineSocketReturn<T> = [string, {
  open(ws: ServerWebSocket<T>): void;
  message: (ws: ServerWebSocket<T>, event: BPEvent) => void;
}]