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
