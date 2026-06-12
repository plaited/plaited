import { keyMirror } from '../utils.ts'

/**
 * Event keys used for messages emitted by the server/agent toward the browser
 * controller.
 *
 * @public
 */
export const AGENT_TO_CONTROLLER_EVENTS = keyMirror('attrs', 'render', 'import')

/**
 * Event keys used for messages emitted by the browser controller toward the
 * behavioral engine.
 *
 * @public
 */
export const CONTROLLER_TO_AGENT_EVENTS = keyMirror('ui_event', 'error', 'form_submit', 'page_reveal', 'page_swap')

export const AGENT_RUNTIMES = keyMirror('analyst', 'coder')

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
