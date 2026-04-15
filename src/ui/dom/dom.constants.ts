import { AGENT_TO_CONTROLLER_EVENTS, BRIDGE_UI_CORE_ID, CONTROLLER_TO_AGENT_EVENTS } from '../../bridge-events.ts'
import { keyMirror } from '../../utils.ts'

export { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS }

/** Stable extension id for the document-level UI runtime core. */
export const UI_CORE = BRIDGE_UI_CORE_ID

/**
 * Event keys emitted and handled by the UI core extension.
 *
 * @remarks
 * These events are installed through `useExtension(UI_CORE, ...)` and are
 * triggered through the scoped core lane (`ui_core:<event>`).
 * `update_behavioral` remains wire-compatible and is translated internally to
 * `update_extension`.
 */
export const UI_CORE_EVENTS = keyMirror(
  AGENT_TO_CONTROLLER_EVENTS.attrs,
  'connect',
  AGENT_TO_CONTROLLER_EVENTS.disconnect,
  'on_ws_error',
  'on_ws_message',
  AGENT_TO_CONTROLLER_EVENTS.render,
  'retry',
  'update_extension',
  CONTROLLER_TO_AGENT_EVENTS.user_action,
)

/** @internal Retry status codes that warrant reconnection attempts. */
export const UI_CORE_RETRY_STATUS_CODES = new Set([1006, 1012, 1013])

/** @internal Maximum number of reconnection attempts before giving up. */
export const UI_CORE_MAX_RETRIES = 3

/** @internal Snapshot memory TTL for installer-backed extension context. */
export const UI_CORE_MEMORY_TTL_MS = 60_000

/** @internal Optional cap on remembered snapshot keys for the installer context. */
export const UI_CORE_MEMORY_MAX_KEYS = 1_000

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
