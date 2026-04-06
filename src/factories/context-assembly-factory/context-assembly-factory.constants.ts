import { keyMirror } from '../../utils.ts'

export const CONTEXT_ASSEMBLY_FACTORY_EVENTS = keyMirror(
  'context_assembly_factory_rebuild',
  'context_assembly_factory_updated',
)

export const CONTEXT_ASSEMBLY_FACTORY_SIGNAL_KEYS = {
  request: 'context_assembly_factory_request',
} as const
