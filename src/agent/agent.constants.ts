import { keyMirror } from '../utils.ts'

/**
 * Minimal engine-level events for the new agent core.
 *
 * @remarks
 * These are intentionally narrower than the legacy loop event surface.
 * Modules can build richer orchestration on top of them.
 *
 * @public
 */
export const AGENT_EVENTS = keyMirror(
  'request_inference',
  'request_tts',
  'read_file',
  'write_file',
  'delete_file',
  'glob_files',
  'grep',
  'bash',
  'agent_disconnect',
  'heartbeat',
  'update_modules',
  'agent_tool_result',
  'signal_schema_violation',
  'set_signal',
)
