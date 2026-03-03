import type { TLSOptions } from 'bun'
import type { Trigger } from '../behavioral.ts'
import type { WebSocketData } from './server.schemas.ts'

/** Route map type extracted from Bun.serve, parameterized with our WebSocket data */
type ServeRoutes = Bun.Serve.Routes<WebSocketData, string>

/**
 * Factory options for {@link createServer}.
 *
 * @param trigger - BP event injection function — server lifecycle events flow through this
 * @param routes - Caller-provided route map passed directly to `Bun.serve()`
 * @param port - Port to listen on (0 for random, default 0)
 * @param tls - TLS certificate options passed to Bun.serve
 * @param allowedOrigins - Set of allowed Origin header values for WebSocket upgrades
 *
 * @public
 */
export type CreateServerOptions = {
  trigger: Trigger
  routes: ServeRoutes
  port?: number
  tls?: TLSOptions
  allowedOrigins?: Set<string>
}
