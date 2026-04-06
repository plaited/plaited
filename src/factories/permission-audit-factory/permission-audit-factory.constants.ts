import { keyMirror } from '../../utils.ts'

export const PERMISSION_AUDIT_FACTORY_EVENTS = keyMirror('permission_audit_factory_updated')

export const PERMISSION_AUDIT_FACTORY_SIGNAL_KEYS = {
  ledger: 'permission_audit_factory_ledger',
} as const
