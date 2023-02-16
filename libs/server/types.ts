import { rutt } from '../deps.ts'

export type HandlerContext<T = unknown> = rutt.HandlerContext<T>
export type Handler<T = unknown> = rutt.Handler<T>
export type ErrorHandler<T = unknown> = rutt.ErrorHandler<T>
export type UnknownMethodHandler<T = unknown> = rutt.UnknownMethodHandler<T>
export type MatchHandler<T = unknown> = rutt.MatchHandler<T>
export type Routes<T = unknown> = rutt.Routes<T>

export type Credentials = {
  /** Server private key in PEM format */
  key: string

  /** Cert chain in PEM format */
  cert: string
}

export type Start = (args: {
  root: string
  routes: Routes
  dev?: boolean
  port?: number
  credentials?: Credentials
  notFoundTemplate?: string
  errorHandler?: ErrorHandler
  unknownMethodHandler?: UnknownMethodHandler
}) => Promise<{
  ips: string[]
  port?: number
  protocol: 'http' | 'https'
  root: string
  url: string
  close: () => Promise<void>
}>

export type ReloadClient = (channel: string, data: string) => void

export type Middleware = (
  handler: Handler,
) => (req: Request, ctx: HandlerContext) => Promise<Response>

export type CreateServer = (args: {
  credentials?: Credentials
  routeHandler: Handler
  port: number
  signal?: AbortSignal
  root: string
  middleware?: Middleware
  protocol: 'http' | 'https'
}) => void

export type GetRouteHandler = (args: {
  routes: Routes
  reload: boolean
  reloadClients: ReloadClient[]
  otherHandler?: Handler
  errorHandler?: ErrorHandler
  unknownMethodHandler?: UnknownMethodHandler
}) => Handler

export type GetReloadRoute = (
  reloadClient: Array<ReloadClient>,
) => Routes
