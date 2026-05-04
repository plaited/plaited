import { keyMirror } from '../utils.ts'

export const EVAL_COMMAND = 'eval' as const

export const EVAL_MODES = keyMirror('grade', 'compare', 'calibrate')

export const EVAL_TRIAL_STATUSES = keyMirror('completed', 'failed', 'timed_out', 'cancelled')

export const EVAL_GRADER_TYPES = keyMirror('process', 'command', 'json')

export const EVAL_GRADER_WHEN = keyMirror('always', 'completed')

export const EVAL_COMMAND_OUTPUTS = keyMirror('exit_code', 'grader_json')

export const EVAL_CALIBRATE_FOCUSES = keyMirror('required_failures', 'all_failures', 'all')

export const EVAL_CALIBRATE_SNAPSHOT_MODES = keyMirror('diagnostic', 'all')

export const EVAL_CALIBRATE_REVIEW_LABELS = keyMirror(
  'correct_accept',
  'incorrect_accept',
  'correct_reject',
  'incorrect_reject',
  'ambiguous',
  'needs_human',
)
