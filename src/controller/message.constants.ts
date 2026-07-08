import { keyMirror } from '../utils.ts'

/**
 * Event keys used for messages emitted by the browser controller to the
 * behavioral engine.
 *
 * @public
 */
export const CONTROLLER_TO_SERVER_EVENTS = keyMirror('ui_event', 'error', 'form_submit', 'success', 'snapshot')

/**
 * Page lifecycle event keys observed by the browser controller and reported
 * back to the server via snapshot messages.
 *
 * @public
 */
export const PAGE_EVENTS = keyMirror('pagereveal', 'pageswap', 'pagehide', 'pageshow')

/**
 * Attribute and request-header key marking a form submission triggered by the
 * controller, so the server can distinguish controller-initiated submits from
 * native ones.
 *
 * @public
 */
export const P_FORM_TRIGGER = 'p-form-trigger'
