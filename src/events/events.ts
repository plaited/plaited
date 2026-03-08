import { keyMirror } from '../utils.ts'

export const CLIENT_LIFECYCLE_EVENTS = keyMirror('client_connected', 'client_disconnected', 'client_error')

export const CLIENT_TO_AGENT_EVENTS = keyMirror('user_action', 'snapshot')

export const AGENT_TO_CONTROLLER_EVENTS = keyMirror('attrs', 'disconnect', 'render', 'update_behavioral')
