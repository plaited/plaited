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
  'actors_scan',
  'bash',
  'heartbeat',
  'tool_bash_approved',
  'tool_bash_denied',
  'tool_bash_request',
  'tool_bash_result',
)

export const AGENT_CORE = 'agent_core'
