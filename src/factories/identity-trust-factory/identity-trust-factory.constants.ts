import { keyMirror } from '../../utils.ts'

export const IDENTITY_TRUST_FACTORY_EVENTS = keyMirror(
  'identity_trust_factory_verify_peer',
  'identity_trust_factory_updated',
)

export const IDENTITY_TRUST_FACTORY_SIGNAL_KEYS = {
  state: 'identity_trust_factory_state',
} as const
