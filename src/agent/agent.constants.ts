import { BRIDGE_AGENT_CORE_ID } from '../bridge-events.ts'
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
export const AGENT_CORE_EVENTS = keyMirror(
  'bash',
  'heartbeat',
  'tool_bash_approved',
  'tool_bash_denied',
  'tool_bash_request',
  'tool_bash_result',
  'update_modules',
)

export const AGENT_CORE = BRIDGE_AGENT_CORE_ID
