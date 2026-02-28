import { keyMirror } from '../../utils.ts'

/**
 * Event type constants for the generative UI controller protocol.
 *
 * @remarks
 * Partitioned by direction:
 * - **Server → Client**: `render`, `attrs`, `update_behavioral`, `disconnect`
 * - **Client → Server**: `client_connected`, `user_action`, `snapshot`
 * - **WebSocket lifecycle**: `connect`, `retry`, `on_ws_open`, `on_ws_message`, `on_ws_error`
 *
 * @public
 */
export const CONTROLLER_EVENTS = keyMirror(
  // Server → Client
  'attrs',
  'disconnect',
  'render',
  'update_behavioral',
  // Client → Server
  'client_connected',
  'user_action',
  'snapshot',
  // WebSocket lifecycle
  'connect',
  'retry',
  'on_ws_error',
  'on_ws_message',
  'on_ws_open',
)

/**
 * Event types blocked from the external `restrictedTrigger`.
 *
 * @remarks
 * Server messages arrive via WebSocket, parsed, and dispatched through
 * `restrictedTrigger`. Internal lifecycle events (`connect`, `retry`, etc.)
 * and client-to-server events (`client_connected`, `user_action`, etc.) are
 * in this set to prevent server-side messages from triggering internal state.
 *
 * @public
 */
export const RESTRICTED_EVENTS = keyMirror(
  // Client → Server
  CONTROLLER_EVENTS.client_connected,
  CONTROLLER_EVENTS.user_action,
  CONTROLLER_EVENTS.snapshot,
  // WebSocket lifecycle
  CONTROLLER_EVENTS.connect,
  CONTROLLER_EVENTS.retry,
  CONTROLLER_EVENTS.on_ws_error,
  CONTROLLER_EVENTS.on_ws_message,
  CONTROLLER_EVENTS.on_ws_open,
)

/**
 * DOM insertion modes for the `render` server message.
 *
 * @remarks
 * Maps to standard DOM insertion methods:
 * - `innerHTML` — replace all children (default)
 * - `outerHTML` — replace the target element itself
 * - `afterbegin` / `beforeend` — prepend / append inside target
 * - `beforebegin` / `afterend` — insert before / after target
 *
 * @public
 */
export const SWAP_MODES = keyMirror('afterbegin', 'afterend', 'beforebegin', 'beforeend', 'innerHTML', 'outerHTML')

/**
 * Error message keys for the controller runtime.
 *
 * @public
 */
export const CONTROLLER_ERRORS = keyMirror(`${CONTROLLER_EVENTS.attrs}_element_not_found`)
