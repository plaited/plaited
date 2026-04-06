import { keyMirror } from '../../utils.ts'

export const PERMISSION_AUDIT_MODULE_EVENTS = keyMirror('permission_audit_module_updated')

export const PERMISSION_AUDIT_MODULE_SIGNAL_KEYS = {
  ledger: 'permission_audit_module_ledger',
} as const
