import { keyMirror } from '../utils.ts'

export const WORKER_MESSAGE = 'worker_message'

export const WORKER_EVENTS = keyMirror('run', 'setup', 'cancel')

export const SESSION_EVENTS = keyMirror(
  'agent_message_chunk',
  'agent_thought_chunk',
  'tool_call',
  'tool_call_update',
  'plan',
  'available_commands_update',
  'current_mode_update',
  'user_message_chunk',
  'config_option_update',
  'session_info_update',
  'error',
)
