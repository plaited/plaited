import { keyMirror } from '../../utils.ts'

export const THREE_AXIS_FACTORY_EVENTS = keyMirror('three_axis_factory_evaluate', 'three_axis_factory_updated')

export const THREE_AXIS_FACTORY_SIGNAL_KEYS = {
  state: 'three_axis_factory_state',
} as const
