import type { BPEvent, Actions, Trigger, Thread, Loop, Sync, Rules, Snapshot } from '../behavioral/types.js'

export type ServerWebSocket<T = unknown> = Parameters<
  Extract<Parameters<typeof Bun.serve<T>>[0], { websocket: unknown; unix?: never }>['websocket']['message']
>['0']

export type DefineSocketHandler<T> = (args: {
  send: (address: string) => (event: BPEvent<string>) => ReturnType<ServerWebSocket['send']>
  rules: Rules
  trigger: Trigger
  thread: Thread
  loop: Loop
  sync: Sync
  snapshot: Snapshot 
  getContext: () => T
}) => Actions

export type DefineSocketConfig = { publicEvents: string[]; address: string }

export type DefineSocketReturn<T> = {
  address: string
  open(ws: ServerWebSocket<T>): void
  message: (ws: ServerWebSocket<T>, event: BPEvent) => void
}

export type MiddleWareHandler = <T extends Record<string, unknown> = Record<string, unknown>>(
  req: Request,
  ctx?: T & { next: Handler },
) => Promise<Response>

export type Handler = <T extends Record<string, unknown> = Record<string, unknown>>(
  req: Request,
  ctx?: T,
) => Promise<Response>

export type AjaxPageData = [Document, Record<string, Element | string>]