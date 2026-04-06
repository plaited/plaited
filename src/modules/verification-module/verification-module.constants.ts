import { keyMirror } from '../../utils.ts'

export const VERIFICATION_MODULE_EVENTS = keyMirror('verification_module_run', 'verification_module_updated')

export const VERIFICATION_MODULE_SIGNAL_KEYS = {
  report: 'verification_module_report',
} as const
