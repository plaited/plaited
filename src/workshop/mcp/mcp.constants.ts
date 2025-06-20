import { keyMirror } from '../../utils/key-mirror.js'

export const MCP_EVENTS = keyMirror('MCP_TOOL_CALL', 'MCP_RESPONSE')

export const MCP_TOOL_EVENTS = keyMirror('MCP_LIST_ROUTES', 'MCP_TEST_ALL_STORIES', 'MCP_TEST_STORY_SET')