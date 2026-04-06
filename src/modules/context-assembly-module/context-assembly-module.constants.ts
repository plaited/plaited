import { keyMirror } from '../../utils.ts'

export const CONTEXT_ASSEMBLY_MODULE_EVENTS = keyMirror(
  'context_assembly_module_rebuild',
  'context_assembly_module_updated',
)

export const CONTEXT_ASSEMBLY_MODULE_SIGNAL_KEYS = {
  request: 'context_assembly_module_request',
} as const
