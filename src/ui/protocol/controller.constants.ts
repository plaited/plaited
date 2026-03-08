import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../../events.ts'
import { keyMirror } from '../../utils.ts'
/**
 * Event type constants for the generative UI controller protocol.
 *
 * @remarks
 * WebSocket-internal lifecycle events for the controller.
 * Cross-module events live in `src/events/` (`UI_ADAPTER_LIFECYCLE_EVENTS`,
 * `AGENT_TO_CONTROLLER_EVENTS`, `CONTROLLER_TO_AGENT_EVENTS`).
 *
 * @public
 */
export const WEBSOCKET_LIFECYCLE_EVENTS = keyMirror('connect', 'retry', 'on_ws_error', 'on_ws_message')

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
  CONTROLLER_TO_AGENT_EVENTS.user_action,
  CONTROLLER_TO_AGENT_EVENTS.snapshot,
  // WebSocket lifecycle
  WEBSOCKET_LIFECYCLE_EVENTS.connect,
  WEBSOCKET_LIFECYCLE_EVENTS.retry,
  WEBSOCKET_LIFECYCLE_EVENTS.on_ws_error,
  WEBSOCKET_LIFECYCLE_EVENTS.on_ws_message,
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
export const CONTROLLER_ERRORS = keyMirror(`${AGENT_TO_CONTROLLER_EVENTS.attrs}_element_not_found`)
