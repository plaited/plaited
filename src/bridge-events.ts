import { keyMirror } from './utils.ts'

/**
 * Event keys used for messages emitted by the server/agent toward the browser
 * controller.
 *
 * @public
 */
export const AGENT_TO_CONTROLLER_EVENTS = keyMirror('attrs', 'disconnect', 'render', 'import')

/**
 * Event keys used for messages emitted by the browser controller toward the
 * behavioral engine.
 *
 * @public
 */
export const CONTROLLER_TO_AGENT_EVENTS = keyMirror('ui_event', 'error', 'import_invoked', 'form_submit')
