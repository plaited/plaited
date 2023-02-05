import { rutt } from '../deps.ts'

export type HandlerContext<T = unknown> = rutt.HandlerContext<T>
export type Handler<T = unknown> = rutt.Handler<T>
export type ErrorHandler<T = unknown> = rutt.ErrorHandler<T>
export type UnknownMethodHandler<T = unknown> = rutt.UnknownMethodHandler<T>
export type MatchHandler<T = unknown> = rutt.MatchHandler<T>
export type Routes<T = unknown> = rutt.Routes<T>

export type Credentials = {
  /** Server private key in PEM format */
  key?: string

  /** Cert chain in PEM format */
  cert?: string

  /** The path to the file containing the TLS private key. */
  keyFile?: string

  /** The path to the file containing the TLS certificate */
  certFile?: string
}

export type UpdateRoutes = (cb: (oldRoutes: Routes) => Routes) => void

export type Server = (args: {
  root: string
  routes: Routes
  dev?: boolean
  port?: number
  credentials?: Credentials
  notFoundTemplate?: string
  errorHandler?: ErrorHandler
  unknownMethodHandler?: UnknownMethodHandler
}) => Promise<{
  updateRoutes: UpdateRoutes
  ips: string[]
  port?: number
  protocol: 'http' | 'https'
  root: string
  url: string
}>

export type ReloadClient = (channel: string, data: string) => void

export type CreateServer = ({
  handler,
  credentials,
  port,
  signal,
  onListen,
  root,
}: {
  credentials?: Credentials
  handler: Handler
  port: number
  signal?: AbortSignal
  root: string
  onListen?: (params: {
    hostname: string
    port: number
  }) => void
}) => void

export type GetHandler = <T = unknown>(args: {
  routes: Routes
  reload: boolean
  reloadClients: ReloadClient[]
  otherHandler?: Handler
  errorHandler?: ErrorHandler
  unknownMethodHandler?: UnknownMethodHandler
}) => Handler

export type GetReloadRoute = (
  reload: boolean,
  reloadClient: Array<ReloadClient>,
) => Record<never, never> | Routes
