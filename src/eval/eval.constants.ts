import { keyMirror } from '../utils.ts'

export const EVAL_COMMAND = 'eval' as const

export const EVAL_MODES = keyMirror('grade', 'compare')

export const EVAL_TRIAL_STATUSES = keyMirror('completed', 'failed', 'timed_out', 'cancelled')

export const EVAL_GRADER_TYPES = keyMirror('process', 'command', 'json')

export const EVAL_GRADER_WHEN = keyMirror('always', 'completed')

export const EVAL_COMMAND_OUTPUTS = keyMirror('exit_code', 'grader_json')
