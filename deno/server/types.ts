import {
  type ErrorHandler,
  type Handler,
  type HandlerContext,
  // deno-lint-ignore no-unused-vars
  type MatchHandler,
  type Routes,
  type UnknownMethodHandler,
} from './router.js'

export type Credentials = {
  /** Server private key in PEM format */
  key: string

  /** Cert chain in PEM format */
  cert: string
}

export type Server = (args: {
  /** path to watch for reloading client automatically  */
  root?: string
  /**
   * A record of route paths and {@link MatchHandler}s which are called when a match is
   * found along with it's values.
   *
   * The route paths follow the {@link URLPattern} format with the addition of
   * being able to prefix a route with a method name and the `@` sign. For
   * example a route only accepting `GET` requests would look like: `GET@/`.
   */
  routes: Routes
  /** causes the browser to reload when files change  default to true*/
  reload?: boolean
  /** The port top listen on defaults to 3000 */
  port?: number
  /**
   * @param credentials credentials for TLS
   * @param credentials.cert Cert chain in PEM format
   * @param credentials.key Server private key in PEM format
   */
  credentials?: Credentials
  /**
   * The default other handler for the router. By default it responds with `null`
   * body and a status of 404.
   */
  otherHandler?: Handler
  /**
   * The default error handler for the router. By default it responds with `null`
   * body and a status of 500 along with `console.error` logging the caught error.
   */
  errorHandler?: ErrorHandler
  /**
   * The default unknown method handler for the router. By default it responds
   * with `null` body, a status of 405 and the `Accept` header set to all
   * {@link KnownMethod known methods}.
   */
  unknownMethodHandler?: UnknownMethodHandler
  /**
   * Middleware function that can be used to intercept request to
   * for example return 401 Unauthorized on unauthenticated users
   */
  middleware?: Middleware
}) => {
  /** network ip addresses */
  ips: string[]
  /** current port being listened to */
  port?: number
  /** protocol server is running under */
  protocol: 'http' | 'https'
  /** url to open in browser */
  url: string
  /** callback function to  close server*/
  close: () => Promise<void>
  /** reloads connected client when called */
  reloadClient: () => void
}

/**
 * Middleware function that can be used to intercept request to
 * for example return 401 Unauthorized on unauthenticated users
 */
export type Middleware = (
  handler: Handler,
) => (req: Request, ctx: HandlerContext) => Promise<Response>

export type GetRouteHandler = (args: {
  routes: Routes
  reload?: boolean
  reloadClients: Set<WebSocket>
  otherHandler?: Handler
  errorHandler?: ErrorHandler
  unknownMethodHandler?: UnknownMethodHandler
}) => Handler

export type RouteEntry = [`/${string}`, Handler]

export type GetReloadRoute = (
  reloadClient: Set<WebSocket>,
) => RouteEntry
