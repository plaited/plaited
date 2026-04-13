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
export const AGENT_CORE_EVENTS = keyMirror('bash', 'heartbeat', 'update_modules')

export const AGENT_CORE = 'agent_core'
