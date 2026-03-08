import { keyMirror } from '../utils.ts'

export const UI_ADAPTER_LIFECYCLE_EVENTS = keyMirror('client_connected', 'client_disconnected', 'client_error')

export const CONTROLLER_TO_AGENT_EVENTS = keyMirror('user_action', 'snapshot')

export const AGENT_TO_CONTROLLER_EVENTS = keyMirror('attrs', 'disconnect', 'render', 'update_behavioral')
