export const GIT_COMMAND = 'git'

export const GIT_MODES = {
  status: 'status',
  history: 'history',
  worktrees: 'worktrees',
  context: 'context',
} as const

export const DEFAULT_HISTORY_LIMIT = 20
export const MAX_HISTORY_LIMIT = 200
export const MAX_FILE_LIST_ENTRIES = 200
export const BROAD_CHANGED_FILE_THRESHOLD = 80
export const BROAD_COMMIT_THRESHOLD = 40
