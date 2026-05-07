import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../shared/shared.constants.ts'
import { keyMirror } from '../utils.ts'

export { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS }

/** @internal WebSocket close codes that warrant reconnect attempts. */
export const UI_CORE_RETRY_STATUS_CODES = new Set([1006, 1012, 1013])

/** @internal Maximum reconnect attempts before a controller island gives up. */
export const UI_CORE_MAX_RETRIES = 3

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
 * Controller diagnostic keys used for protocol handling failures.
 *
 * @public
 */
export const CONTROLLER_ERRORS = keyMirror(`${AGENT_TO_CONTROLLER_EVENTS.attrs}_element_not_found`)
