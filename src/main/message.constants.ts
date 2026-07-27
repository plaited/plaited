import { keyMirror } from '../utils.ts'

/**
 * Event keys used for messages emitted by the browser controller to the
 * behavioral engine.
 *
 * @public
 */
export const CONTROLLER_OUTGOING_MESSAGE_TYPES = keyMirror('ui_event', 'error', 'form_submit', 'success', 'snapshot')

/**
 * Page lifecycle event keys observed by the browser controller and reported
 * back to the server via snapshot messages.
 *
 * @public
 */
export const PAGE_EVENTS = keyMirror('pagereveal', 'pageswap', 'pagehide', 'pageshow')

/**
 * Event keys used for messages emitted by the behavioral engine to the browser
 * controller.
 *
 * @public
 */
export const CONTROLLER_INCOMING_MESSAGE_TYPES = keyMirror('attrs', 'render', 'dispatch_custom_event', 'navigate')

/**
 * Event keys used for messages emitted by the behavioral engine to the browser
 * controller.
 *
 * @public
 */
export const RENDERER_RESULTS_MESSAGE_TYPES = keyMirror('attrs_result', 'render_result')

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
