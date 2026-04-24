import { keyMirror } from '../../utils.ts'

/**
 * CLI mode discriminants for the behavioral-frontier command.
 *
 * @public
 */
export const BEHAVIORAL_FRONTIER_MODES = keyMirror('replay', 'explore', 'verify')

/**
 * Exploration strategies supported by the behavioral-frontier command.
 *
 * @public
 */
export const BEHAVIORAL_FRONTIER_STRATEGIES = keyMirror('bfs', 'dfs')

/**
 * Verification statuses emitted by the behavioral-frontier command.
 *
 * @public
 */
export const BEHAVIORAL_FRONTIER_VERIFY_STATUSES = keyMirror('verified', 'failed', 'truncated')

/**
 * Event provenance values accepted in replay history rows.
 *
 * @public
 */
export const BEHAVIORAL_FRONTIER_EVENT_SOURCES = keyMirror('trigger', 'request')

/**
 * Canonical command name for the frontier CLI surface.
 *
 * @public
 */
export const BEHAVIORAL_FRONTIER_COMMAND = 'behavioral-frontier'
