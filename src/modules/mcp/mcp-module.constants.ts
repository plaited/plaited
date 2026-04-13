import { keyMirror } from '../../utils.ts'

export const MCP_MODULE_EVENTS = keyMirror('mcp_module_register_server', 'mcp_module_record_call', 'mcp_module_updated')

export const MCP_MODULE_SIGNAL_KEYS = {
  state: 'mcp_module_state',
} as const
