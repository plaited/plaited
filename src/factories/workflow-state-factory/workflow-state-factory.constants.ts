import { keyMirror } from '../../utils.ts'

export const WORKFLOW_STATE_FACTORY_EVENTS = keyMirror('workflow_state_factory_updated')

export const WORKFLOW_STATE_FACTORY_SIGNAL_KEYS = {
  state: 'workflow_state_factory_state',
} as const
