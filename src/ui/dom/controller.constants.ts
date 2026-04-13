import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../../bridge-events.ts'
import { keyMirror } from '../../utils.ts'

export { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS }

/**
 * WebSocket lifecycle event keys emitted within the controller runtime.
 *
 * @remarks
 * These events stay inside the browser-side controller implementation. Shared
 * protocol events that cross the client/server boundary are defined in
 * `AGENT_TO_CONTROLLER_EVENTS` and `CONTROLLER_TO_AGENT_EVENTS`.
 *
 * @public
 */
export const WEBSOCKET_LIFECYCLE_EVENTS = keyMirror('connect', 'retry', 'on_ws_error', 'on_ws_message')

/**
 * Event keys that server-originated messages must not trigger through `restrictedTrigger`.
 *
 * @remarks
 * The controller dispatches parsed server messages through a restricted
 * trigger surface. This set excludes browser-local lifecycle events and
 * controller-to-agent events so inbound messages cannot impersonate internal
 * state transitions.
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
 * Supported DOM insertion modes for `render` protocol messages.
 *
 * @remarks
 * These values align with the insertion positions accepted by the controller's
 * DOM update path, plus `innerHTML` and `outerHTML` replacement modes.
 *
 * @public
 */
export const SWAP_MODES = keyMirror('afterbegin', 'afterend', 'beforebegin', 'beforeend', 'innerHTML', 'outerHTML')

/**
 * Controller error detail keys emitted for protocol handling failures.
 *
 * @public
 */
export const CONTROLLER_ERRORS = keyMirror(`${AGENT_TO_CONTROLLER_EVENTS.attrs}_element_not_found`)
