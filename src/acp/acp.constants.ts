/**
 * ACP protocol constants.
 *
 * @remarks
 * Contains all constant values used across the ACP client implementation:
 * - Protocol method names
 * - Protocol version
 * - JSON-RPC error codes
 */

// ============================================================================
// Protocol Methods
// ============================================================================

/** ACP method names */
export const ACP_METHODS = {
  // Lifecycle
  INITIALIZE: 'initialize',
  SHUTDOWN: 'shutdown',

  // Sessions
  CREATE_SESSION: 'session/new',
  LOAD_SESSION: 'session/load',
  PROMPT: 'session/prompt',
  CANCEL: 'session/cancel',
  UPDATE: 'session/update',
  REQUEST_PERMISSION: 'session/request_permission',
  SET_MODEL: 'session/set_model',

  // Protocol-level
  CANCEL_REQUEST: '$/cancel_request',
} as const

// ============================================================================
// Protocol Version
// ============================================================================

/** Current protocol version - SDK uses number type */
export const ACP_PROTOCOL_VERSION = 1 as const

// ============================================================================
// JSON-RPC Error Codes
// ============================================================================

/** Standard JSON-RPC error codes */
export const JSON_RPC_ERRORS = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  REQUEST_CANCELLED: -32800,
} as const

/** Default ACP Client Name */
export const DEFAULT_ACP_CLIENT_NAME = 'plaited-acp-client'
