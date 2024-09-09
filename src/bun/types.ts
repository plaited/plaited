import type {
  BPEvent,
  Actions,
  Trigger,
  BThreads,
  BSync,
  BThread,
  UseSnapshot,
  UseFeedback,
} from '../behavioral.js'
import { Attrs, TemplateObject } from '../jsx/jsx.types.js';

export type ServerWebSocket<T = unknown> = Parameters<
  Extract<Parameters<typeof Bun.serve<T>>[0], { websocket: unknown; unix?: never }>['websocket']['message']
>['0']

export type DefineSocketHandler<T> = (args: {
  send: (address: string) => (event: BPEvent<string>) => ReturnType<ServerWebSocket['send']>
  trigger: Trigger
  useSnapShot: UseSnapshot
  useFeedback: UseFeedback
  bThreads: BThreads
  bSync: BSync
  bThread: BThread
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


export type Story<T = Attrs> = {
  render: (attrs: T) => TemplateObject
  play: (attrs: T) => void
  description?: string
  a11y: []
  attrs: T
}