import { keyMirror } from '../utils.ts'

/**
 * Event keys used for messages emitted by the behavioral engine to the browser
 * controller.
 *
 * @public
 */
export const SERVER_TO_CONTROLLER_EVENTS = keyMirror('attrs', 'render', 'dispatch_custom_event', 'navigate')

/**
 * Event keys used for messages emitted by the browser controller to the
 * behavioral engine.
 *
 * @public
 */
export const CONTROLLER_TO_SERVER_EVENTS = keyMirror('ui_event', 'error', 'form_submit', 'success', 'snapshot')

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

export const PAGE_EVENTS = keyMirror('pagereveal', 'pageswap', 'pagehide', 'pageshow')

export const P_FORM_TRIGGER = 'p-form-trigger'

export const FLAT_NODE_KINDS = keyMirror('element')
