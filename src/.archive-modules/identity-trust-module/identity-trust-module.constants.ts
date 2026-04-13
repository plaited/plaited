import { keyMirror } from '../../utils.ts'

export const IDENTITY_TRUST_MODULE_EVENTS = keyMirror(
  'identity_trust_module_verify_peer',
  'identity_trust_module_updated',
)

export const IDENTITY_TRUST_MODULE_SIGNAL_KEYS = {
  state: 'identity_trust_module_state',
} as const
