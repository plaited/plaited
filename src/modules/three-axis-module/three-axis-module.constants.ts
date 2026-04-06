import { keyMirror } from '../../utils.ts'

export const THREE_AXIS_MODULE_EVENTS = keyMirror('three_axis_module_evaluate', 'three_axis_module_updated')

export const THREE_AXIS_MODULE_SIGNAL_KEYS = {
  state: 'three_axis_module_state',
} as const
