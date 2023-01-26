import { IncomingMessage, ServerResponse } from 'http'

export type Handler =
  ((
    req: IncomingMessage,
    ctx: ServerResponse,
  ) => Promise<void>) |
  (
    (
      req: IncomingMessage,
      ctx: ServerResponse,
    ) => void
  )

/**
 * A handler type for anytime the `MatchHandler` or `other` parameter handler
 * fails
 */
export type ErrorHandler = (
  req: IncomingMessage,
  ctx: ServerResponse,
  err: unknown,
) => void

/**
 * A handler type for anytime a method is received that is not defined
 */
export type UnknownMethodHandler = (
  req: IncomingMessage,
  ctx: ServerResponse,
  knownMethods: string[],
) => void

/**
 * A handler type for a router path match which gets passed the matched values
 */
export type MatchHandler = ((
    req: IncomingMessage,
    ctx: ServerResponse,
    match: URLPatternComponentResult['groups'],
  ) => void)|
  ((
    req: IncomingMessage,
    ctx: ServerResponse,
    match: URLPatternComponentResult['groups'],
  ) =>Promise<void >)

/**
 * A object for declaring routes that are either `Handler` or `MatchHandler` type
 */
export type Routes = {
  [x: string]: Handler | MatchHandler 
}


export type ServerCallback  = (req: IncomingMessage, res: ServerResponse) => void


export type Server = (args: {
  root: string
  routes:Routes
  reload?: boolean
  port?: number
  inject?: string
  credentials?: {
    key: string | Buffer
    cert: string | Buffer
  }
  otherHandler?: Handler
  errorHandler?: ErrorHandler
  unknownMethodHandler?: UnknownMethodHandler
}) =>Promise<{
  addRoutes: (routes: Routes) => void
  ips: string[]
  port?: number
  protocol: 'http' | 'https'
  root: string
  sendReload?: () => void
  url: string
}>

