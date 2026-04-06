import { keyMirror } from '../../utils.ts'

export const VERIFICATION_FACTORY_EVENTS = keyMirror('verification_factory_run', 'verification_factory_updated')

export const VERIFICATION_FACTORY_SIGNAL_KEYS = {
  report: 'verification_factory_report',
} as const
