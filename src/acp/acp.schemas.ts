/**
 * JSON-RPC 2.0 Zod schemas with runtime validation.
 *
 * @remarks
 * These schemas provide runtime validation for JSON-RPC messages at the
 * transport boundary. While the ACP SDK handles protocol-level types,
 * the JSON-RPC framing layer is our responsibility since we implement
 * a custom stdio transport.
 *
 * The schemas follow JSON-RPC 2.0 specification:
 * - Requests have `id` and `method`
 * - Notifications have `method` but no `id`
 * - Responses have `id` and either `result` or `error`
 */

import type {
  CreateTerminalRequest,
  ReadTextFileRequest,
  RequestPermissionRequest,
  SessionNotification,
  TerminalOutputRequest,
  WriteTextFileRequest,
} from '@agentclientprotocol/sdk'
import { z } from 'zod'
import { isTypeOf } from '../utils/is-type-of.ts'

// ============================================================================
// JSON-RPC Base Schemas
// ============================================================================

/** JSON-RPC version literal */
const JsonRpcVersionSchema = z.literal('2.0')

/** Request/response identifier */
const RequestIdSchema = z.union([z.string(), z.number()])

/**
 * JSON-RPC 2.0 error object schema.
 *
 * @remarks
 * Standard error codes:
 * - `-32700`: Parse error
 * - `-32600`: Invalid request
 * - `-32601`: Method not found
 * - `-32602`: Invalid params
 * - `-32603`: Internal error
 * - `-32800`: Request cancelled (ACP extension)
 */
export const JsonRpcErrorSchema = z.object({
  code: z.number(),
  message: z.string(),
  data: z.unknown().optional(),
})

/** JSON-RPC 2.0 request schema */
export const JsonRpcRequestSchema = z.object({
  jsonrpc: JsonRpcVersionSchema,
  id: RequestIdSchema,
  method: z.string(),
  params: z.unknown().optional(),
})

/** JSON-RPC 2.0 notification schema (no id, no response expected) */
export const JsonRpcNotificationSchema = z.object({
  jsonrpc: JsonRpcVersionSchema,
  method: z.string(),
  params: z.unknown().optional(),
})

/** JSON-RPC 2.0 success response schema */
export const JsonRpcSuccessResponseSchema = z.object({
  jsonrpc: JsonRpcVersionSchema,
  id: RequestIdSchema,
  result: z.unknown(),
})

/** JSON-RPC 2.0 error response schema */
export const JsonRpcErrorResponseSchema = z.object({
  jsonrpc: JsonRpcVersionSchema,
  id: z.union([RequestIdSchema, z.null()]),
  error: JsonRpcErrorSchema,
})

/** Union of all JSON-RPC response types */
export const JsonRpcResponseSchema = z.union([JsonRpcSuccessResponseSchema, JsonRpcErrorResponseSchema])

/**
 * Union of all JSON-RPC message types.
 *
 * @remarks
 * Use `safeParse` at transport boundaries for runtime validation.
 * See transport tests for usage patterns.
 */
export const JsonRpcMessageSchema = z.union([JsonRpcRequestSchema, JsonRpcNotificationSchema, JsonRpcResponseSchema])

// ============================================================================
// Inferred Types
// ============================================================================

/** JSON-RPC 2.0 error object */
export type JsonRpcError = z.infer<typeof JsonRpcErrorSchema>

/** JSON-RPC 2.0 request structure */
export type JsonRpcRequest<T = unknown> = Omit<z.infer<typeof JsonRpcRequestSchema>, 'params'> & {
  params?: T
}

/** JSON-RPC 2.0 notification structure (no id, no response expected) */
export type JsonRpcNotification<T = unknown> = Omit<z.infer<typeof JsonRpcNotificationSchema>, 'params'> & {
  params?: T
}

/** JSON-RPC 2.0 success response */
export type JsonRpcSuccessResponse<T = unknown> = Omit<z.infer<typeof JsonRpcSuccessResponseSchema>, 'result'> & {
  result: T
}

/** JSON-RPC 2.0 error response */
export type JsonRpcErrorResponse = z.infer<typeof JsonRpcErrorResponseSchema>

/** Union of all JSON-RPC response types */
export type JsonRpcResponse<T = unknown> = JsonRpcSuccessResponse<T> | JsonRpcErrorResponse

/** Union of all JSON-RPC message types */
export type JsonRpcMessage<T = unknown> = JsonRpcRequest<T> | JsonRpcNotification<T> | JsonRpcResponse<T>

// ============================================================================
// ACP SDK Type Schemas
// ============================================================================

/**
 * These schemas use z.custom() to validate SDK types at runtime.
 * They validate only the fields we actually use, keeping SDK types
 * as the source of truth while adding runtime safety.
 */

/** Type guard for object shape validation */
const isRecord = (val: unknown): val is Record<string, unknown> => isTypeOf<Record<string, unknown>>(val, 'object')

/**
 * Schema for session update notifications.
 *
 * @remarks
 * Validates `sessionId` and `update` fields used in notification handling.
 */
export const SessionNotificationSchema = z.custom<SessionNotification>(
  (val): val is SessionNotification =>
    isRecord(val) && 'sessionId' in val && typeof val.sessionId === 'string' && 'update' in val && isRecord(val.update),
)

/**
 * Schema for permission requests from agent.
 *
 * @remarks
 * Validates `options` array used in permission handling.
 */
export const RequestPermissionRequestSchema = z.custom<RequestPermissionRequest>(
  (val): val is RequestPermissionRequest => isRecord(val) && 'options' in val && Array.isArray(val.options),
)

/**
 * Schema for file read requests.
 *
 * @remarks
 * Validates `path` field used in sandbox file operations.
 */
export const ReadTextFileRequestSchema = z.custom<ReadTextFileRequest>(
  (val): val is ReadTextFileRequest => isRecord(val) && 'path' in val && typeof val.path === 'string',
)

/**
 * Schema for file write requests.
 *
 * @remarks
 * Validates `path` and `content` fields used in sandbox file operations.
 */
export const WriteTextFileRequestSchema = z.custom<WriteTextFileRequest>(
  (val): val is WriteTextFileRequest =>
    isRecord(val) &&
    'path' in val &&
    typeof val.path === 'string' &&
    'content' in val &&
    typeof val.content === 'string',
)

/**
 * Schema for terminal creation requests.
 *
 * @remarks
 * Validates `command` field; `cwd` and `env` are optional.
 */
export const CreateTerminalRequestSchema = z.custom<CreateTerminalRequest>(
  (val): val is CreateTerminalRequest => isRecord(val) && 'command' in val && typeof val.command === 'string',
)

/**
 * Schema for terminal operation requests (output, wait, kill, release).
 *
 * @remarks
 * Validates `terminalId` field used across terminal operations.
 */
export const TerminalOutputRequestSchema = z.custom<TerminalOutputRequest>(
  (val): val is TerminalOutputRequest => isRecord(val) && 'terminalId' in val && typeof val.terminalId === 'string',
)
