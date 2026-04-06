import { keyMirror } from '../../utils.ts'

export const MCP_FACTORY_EVENTS = keyMirror(
  'mcp_factory_register_server',
  'mcp_factory_record_call',
  'mcp_factory_updated',
)

export const MCP_FACTORY_SIGNAL_KEYS = {
  state: 'mcp_factory_state',
} as const
