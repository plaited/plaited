import { rutt } from '../deps.ts'

export type HandlerContext = rutt.HandlerContext
export type Handler = rutt.Handler
export type ErrorHandler = rutt.ErrorHandler
export type UnknownMethodHandler = rutt.UnknownMethodHandler
export type MatchHandler = rutt.MatchHandler
export type Routes = rutt.Routes

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
