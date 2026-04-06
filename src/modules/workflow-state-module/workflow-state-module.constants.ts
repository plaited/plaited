import { keyMirror } from '../../utils.ts'

export const WORKFLOW_STATE_MODULE_EVENTS = keyMirror('workflow_state_module_updated')

export const WORKFLOW_STATE_MODULE_SIGNAL_KEYS = {
  state: 'workflow_state_module_state',
} as const
