import { keyMirror } from '../../utils.ts'

/**
 * Task lifecycle states per the A2A protocol specification.
 *
 * @remarks
 * Uses kebab-case as defined in the wire format. Access hyphenated
 * keys via bracket notation: `TASK_STATE['input-required']`.
 *
 * @public
 */
export const TASK_STATE = keyMirror(
  'submitted',
  'working',
  'completed',
  'failed',
  'canceled',
  'input-required',
  'rejected',
  'auth-required',
  'unknown',
)

/**
 * Message roles in the A2A protocol.
 *
 * @public
 */
export const MESSAGE_ROLE = keyMirror('user', 'agent')

/**
 * JSON-RPC 2.0 method names for A2A operations.
 *
 * @remarks
 * Slash-separated per spec. Access via bracket notation:
 * `A2A_METHOD['message/send']`.
 *
 * @public
 */
export const A2A_METHOD = keyMirror(
  'message/send',
  'message/stream',
  'tasks/get',
  'tasks/cancel',
  'tasks/resubscribe',
  'tasks/pushNotificationConfig/set',
  'tasks/pushNotificationConfig/get',
  'tasks/pushNotificationConfig/list',
  'tasks/pushNotificationConfig/delete',
  'agent/authenticatedExtendedCard',
)

/**
 * Standard JSON-RPC 2.0 error codes plus A2A-specific codes.
 *
 * @remarks
 * Numeric values — not keyMirror since values differ from keys.
 *
 * @public
 */
export const A2A_ERROR_CODE = {
  /** Standard JSON-RPC: invalid JSON */
  parse_error: -32700,
  /** Standard JSON-RPC: invalid request object */
  invalid_request: -32600,
  /** Standard JSON-RPC: method not found */
  method_not_found: -32601,
  /** Standard JSON-RPC: invalid method parameters */
  invalid_params: -32602,
  /** Standard JSON-RPC: internal error */
  internal_error: -32603,
  /** A2A: task not found */
  task_not_found: -32001,
  /** A2A: task not cancelable */
  task_not_cancelable: -32002,
  /** A2A: push notification not supported */
  push_notification_not_supported: -32003,
  /** A2A: unsupported operation */
  unsupported_operation: -32004,
  /** A2A: content type not supported */
  content_type_not_supported: -32005,
  /** A2A: authentication required */
  unauthorized: -32006,
} as const

/**
 * SSE response headers for streaming A2A responses.
 *
 * @public
 */
export const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
} as const

/**
 * Well-known path for the Agent Card discovery endpoint.
 *
 * @public
 */
export const AGENT_CARD_PATH = '/.well-known/agent-card.json'
