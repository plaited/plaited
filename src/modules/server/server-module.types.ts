import type { Server, TLSOptions } from 'bun'
import type { Trigger } from '../../behavioral.ts'
import type { ClientMessage } from '../../ui.ts'
import type { SERVER_MODULE_ERROR_CODES } from './server-module.constants.ts'
import type { ReplayBufferOptions, WebSocketData, WebSocketLimits } from './server-module.schemas.ts'

export type ServeRoutes = Bun.Serve.Routes<WebSocketData, string>

export type AuthenticatedConnection = {
  connectionId: string
  principalId?: string
  deviceId?: string
  capabilities?: string[]
}

export type AuthenticateConnection = (input: {
  request: Request
  source: string
}) => AuthenticatedConnection | Promise<AuthenticatedConnection | null> | null

export type CreateServerOptions = {
  trigger: Trigger
  onClientMessage: (message: ClientMessage) => void
  reportTransportError: (detail: {
    code: ServerModuleErrorCode
    connectionId?: string
    message?: string
    pathname?: string
  }) => void
  routes: ServeRoutes
  port?: number
  tls?: TLSOptions
  allowedOrigins?: Set<string>
  authenticateConnection: AuthenticateConnection
  wsLimits?: WebSocketLimits
  replayBuffer?: ReplayBufferOptions
  csp?: string | false
}

export type ServerHandle = {
  readonly server: Server<WebSocketData>
  readonly port: number
  send: (topic: string, data: string) => void
  stop: (closeActiveConnections?: boolean) => void
}

export type ServerModuleErrorCode = (typeof SERVER_MODULE_ERROR_CODES)[keyof typeof SERVER_MODULE_ERROR_CODES]
