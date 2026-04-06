import { keyMirror } from './utils.ts'

/**
 * Event keys used for messages emitted by the server/agent toward the browser
 * controller.
 *
 * @public
 */
export const AGENT_TO_CONTROLLER_EVENTS = keyMirror('attrs', 'disconnect', 'render', 'update_behavioral')

/**
 * Event keys used for messages emitted by the browser controller toward the
 * behavioral engine.
 *
 * @public
 */
export const CONTROLLER_TO_AGENT_EVENTS = keyMirror('user_action', 'snapshot')
