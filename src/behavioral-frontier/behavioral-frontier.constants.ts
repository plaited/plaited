import { keyMirror } from '../utils.ts'

export const BEHAVIORAL_FRONTIER_MODES = keyMirror('replay', 'explore', 'verify')

export const BEHAVIORAL_FRONTIER_STRATEGIES = keyMirror('bfs', 'dfs')

export const BEHAVIORAL_FRONTIER_SELECTION_POLICIES = keyMirror('all-enabled', 'scheduler')

export const BEHAVIORAL_FRONTIER_VERIFY_STATUSES = keyMirror('verified', 'failed', 'truncated')
