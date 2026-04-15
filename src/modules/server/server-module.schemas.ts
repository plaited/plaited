import * as z from 'zod'
import { SERVER_MODULE_ERROR_CODES } from './server-module.constants.ts'
import type { AuthenticateConnection, ServeRoutes, ServerModuleErrorCode } from './server-module.types.ts'

export const WebSocketDataSchema = z.object({
  connectionId: z.string().min(1),
  source: z.string().min(1),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
})
export type WebSocketData = z.infer<typeof WebSocketDataSchema>

export const ReplayBufferOptionsSchema = z.object({
  maxSize: z.number().int().nonnegative().optional(),
  ttlMs: z.number().int().nonnegative().optional(),
})
export type ReplayBufferOptions = z.infer<typeof ReplayBufferOptionsSchema>

export const WebSocketLimitsSchema = z.object({
  idleTimeout: z.number().int().nonnegative().optional(),
  maxPayloadLength: z.number().int().nonnegative().optional(),
})
export type WebSocketLimits = z.infer<typeof WebSocketLimitsSchema>

const ServeRoutesSchema = z.custom<ServeRoutes>((value) => value !== null && typeof value === 'object')
const AllowedOriginsSchema = z.custom<Set<string> | undefined>((value) => value === undefined || value instanceof Set)
const AuthenticateConnectionSchema = z.custom<AuthenticateConnection>((value) => typeof value === 'function')
const TLSOptionsSchema = z.custom<Bun.TLSOptions>((_) => true)

export const ServerStartDetailSchema = z.object({
  routes: ServeRoutesSchema.default({}),
  port: z.number().int().nonnegative().default(0),
  tls: TLSOptionsSchema.optional(),
  allowedOrigins: AllowedOriginsSchema.optional(),
  authenticateConnection: AuthenticateConnectionSchema,
  wsLimits: WebSocketLimitsSchema.optional(),
  replayBuffer: ReplayBufferOptionsSchema.optional(),
  csp: z.union([z.string(), z.literal(false)]).optional(),
})
export type ServerStartDetail = z.infer<typeof ServerStartDetailSchema>

export const ServerStopDetailSchema = z
  .object({
    closeActiveConnections: z.boolean().optional(),
  })
  .optional()
export type ServerStopDetail = z.infer<typeof ServerStopDetailSchema>

export const ServerSendDetailSchema = z.object({
  topic: z.string().min(1),
  data: z.string(),
})
export type ServerSendDetail = z.infer<typeof ServerSendDetailSchema>

export const ServerStartedDetailSchema = z.object({
  port: z.number().int().nonnegative(),
})
export type ServerStartedDetail = z.infer<typeof ServerStartedDetailSchema>

export const ServerStoppedDetailSchema = z.object({
  port: z.number().int().nonnegative().optional(),
})
export type ServerStoppedDetail = z.infer<typeof ServerStoppedDetailSchema>

const ServerModuleErrorCodeSchema = z.custom<ServerModuleErrorCode>((value) =>
  Object.values(SERVER_MODULE_ERROR_CODES).includes(value as ServerModuleErrorCode),
)

export const ServerErrorDetailSchema = z.object({
  code: ServerModuleErrorCodeSchema,
  message: z.string().min(1),
})
export type ServerErrorDetail = z.infer<typeof ServerErrorDetailSchema>

export const ClientConnectedDetailSchema = z.object({
  connectionId: z.string().min(1),
  source: z.string().min(1),
  isReconnect: z.boolean(),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
})
export type ClientConnectedDetail = z.infer<typeof ClientConnectedDetailSchema>

export const ClientDisconnectedDetailSchema = z.object({
  connectionId: z.string().min(1),
  code: z.number().int(),
  reason: z.string(),
  principalId: z.string().optional(),
  deviceId: z.string().optional(),
})
export type ClientDisconnectedDetail = z.infer<typeof ClientDisconnectedDetailSchema>

export const ClientErrorDetailSchema = z.object({
  code: ServerModuleErrorCodeSchema,
  connectionId: z.string().min(1).optional(),
  message: z.string().optional(),
  pathname: z.string().optional(),
})
export type ClientErrorDetail = z.infer<typeof ClientErrorDetailSchema>
