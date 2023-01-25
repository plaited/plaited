import { IncomingMessage, ServerResponse } from 'http'

export type Handler = (
  req: IncomingMessage,
  ctx: ServerResponse,
) => void

/**
 * A handler type for anytime the `MatchHandler` or `other` parameter handler
 * fails
 */
export type ErrorHandler<T = unknown> = (
  req: IncomingMessage,
  ctx: ServerResponse,
  err: unknown,
) => void

/**
 * A handler type for anytime a method is received that is not defined
 */
export type UnknownMethodHandler<T = unknown> = (
  req: IncomingMessage,
  ctx: ServerResponse,
  knownMethods: string[],
) => void

/**
 * A handler type for a router path match which gets passed the matched values
 */
export type MatchHandler = (
  req: IncomingMessage,
  ctx: ServerResponse,
  match: URLPatternComponentResult['groups'],
) => void

export type Routes = {
  [x: string]: Handler
}


export type ServerCallback  = (req: IncomingMessage, res: ServerResponse) => void


export type Server = (args: {
  root: string
  assets: string
  routes:Routes
  reload?: boolean
  port?: number
  inject?: string
  credentials?: {
    key: string | Buffer
    cert: string | Buffer
  }
}) =>Promise<{
  url: string
  root: string
  protocol: 'http' | 'https'
  port?: number
  ips: string[]
}>

