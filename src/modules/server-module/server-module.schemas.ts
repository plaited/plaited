import * as z from 'zod'
import { SERVER_MODULE_BASELINE_ROUTE_OWNER } from './server-module.constants.ts'
import type { AuthenticateConnection, CreateServerOptions } from './server-module.types.ts'

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

/**
 * Zod schema for replay buffer configuration.
 *
 * @public
 */
export const ReplayBufferOptionsSchema = z.object({
  maxSize: z.number().int().nonnegative().optional(),
  ttlMs: z.number().int().nonnegative().optional(),
})

/**
 * Zod schema for WebSocket connection limits.
 *
 * @public
 */
export const WebSocketLimitsSchema = z.object({
  idleTimeout: z.number().int().nonnegative().optional(),
  maxPayloadLength: z.number().int().nonnegative().optional(),
})

const ServeRoutesSchema = z.custom<CreateServerOptions['routes']>(
  (value) => value !== null && typeof value === 'object',
)
const RouteContributionsSchema = z.record(z.string(), ServeRoutesSchema).superRefine((value, ctx) => {
  if (SERVER_MODULE_BASELINE_ROUTE_OWNER in value) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `routeContributions must not use reserved contributor id '${SERVER_MODULE_BASELINE_ROUTE_OWNER}'`,
    })
  }
})

const AllowedOriginsSchema = z.custom<Set<string> | undefined>((value) => value === undefined || value instanceof Set)

const AuthenticateConnectionSchema = z.custom<AuthenticateConnection>((value) => typeof value === 'function')

const TLSOptionsSchema = z.custom<CreateServerOptions['tls']>((_) => true)

/**
 * Zod schema for server module configuration.
 *
 * @public
 */
export const ServerModuleConfigSchema = z.object({
  routes: ServeRoutesSchema.default({}),
  routeContributions: RouteContributionsSchema.optional(),
  port: z.number().int().nonnegative().default(0),
  tls: TLSOptionsSchema.optional(),
  allowedOrigins: AllowedOriginsSchema.optional(),
  authenticateConnection: AuthenticateConnectionSchema.optional(),
  wsLimits: WebSocketLimitsSchema.optional(),
  replayBuffer: ReplayBufferOptionsSchema.optional(),
  csp: z.union([z.string(), z.literal(false)]).optional(),
  autostart: z.boolean().default(true),
})

/**
 * Zod schema for server module runtime status.
 *
 * @public
 */
export const ServerModuleStatusSchema = z.object({
  state: z.enum(['stopped', 'starting', 'running', 'error']),
  port: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
})

/**
 * Zod schema for outbound server send requests.
 *
 * @public
 */
export const ServerSendDetailSchema = z.object({
  topic: z.string(),
  data: z.string(),
})

/** @public */
export type ServerModuleConfig = z.infer<typeof ServerModuleConfigSchema>
/** @public */
export type ServerModuleStatus = z.infer<typeof ServerModuleStatusSchema>
/** @public */
export type ServerSendDetail = z.infer<typeof ServerSendDetailSchema>
