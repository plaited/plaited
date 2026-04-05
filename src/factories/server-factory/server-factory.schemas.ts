import * as z from 'zod'
import type { AuthenticateConnection, CreateServerOptions } from './server-factory.types.ts'

/**
 * Schema for contextual data attached to each WebSocket connection.
 *
 * @remarks
 * Set during `server.upgrade()` and available as `ws.data` in all
 * WebSocket lifecycle handlers. `connectionId` is the transport routing key
 * for this attached client. The `source` comes from the
 * `Sec-WebSocket-Protocol` header (client identity: `'document'` or tag name).
 *
 * @public
 */
export const WebSocketDataSchema = z.object({
  connectionId: z.string(),
  source: z.string(),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
})

/** @public */
export type WebSocketData = z.infer<typeof WebSocketDataSchema>

export const ReplayBufferOptionsSchema = z.object({
  maxSize: z.number().int().nonnegative().optional(),
  ttlMs: z.number().int().nonnegative().optional(),
})

export const WebSocketLimitsSchema = z.object({
  idleTimeout: z.number().int().nonnegative().optional(),
  maxPayloadLength: z.number().int().nonnegative().optional(),
})

const ServeRoutesSchema = z.custom<CreateServerOptions['routes']>(
  (value) => value !== null && typeof value === 'object',
)

const AllowedOriginsSchema = z.custom<Set<string> | undefined>((value) => value === undefined || value instanceof Set)

const AuthenticateConnectionSchema = z.custom<AuthenticateConnection>((value) => typeof value === 'function')

const TLSOptionsSchema = z.custom<CreateServerOptions['tls']>((_) => true)

export const ServerFactoryConfigSchema = z.object({
  routes: ServeRoutesSchema.default({}),
  port: z.number().int().nonnegative().default(0),
  tls: TLSOptionsSchema.optional(),
  allowedOrigins: AllowedOriginsSchema.optional(),
  authenticateConnection: AuthenticateConnectionSchema.optional(),
  wsLimits: WebSocketLimitsSchema.optional(),
  replayBuffer: ReplayBufferOptionsSchema.optional(),
  csp: z.union([z.string(), z.literal(false)]).optional(),
  autostart: z.boolean().default(true),
})

export const ServerFactoryStatusSchema = z.object({
  state: z.enum(['stopped', 'starting', 'running', 'error']),
  port: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
})

export const ServerSendDetailSchema = z.object({
  topic: z.string(),
  data: z.string(),
})

export type ServerFactoryConfig = z.infer<typeof ServerFactoryConfigSchema>
export type ServerFactoryStatus = z.infer<typeof ServerFactoryStatusSchema>
export type ServerSendDetail = z.infer<typeof ServerSendDetailSchema>
