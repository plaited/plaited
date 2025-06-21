import { keyMirror } from '../../utils/key-mirror.js'

export const MCP_EVENTS = keyMirror('mcp_tool_call', 'mcp_response')

export const MCP_TOOL_EVENTS = keyMirror('mcp_list_routes', 'mcp_test_all_stories', 'mcp_test_story_set')