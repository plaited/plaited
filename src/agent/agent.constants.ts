import { keyMirror } from '../utils.ts'

export const AGENT_EVENTS = keyMirror(
  'worker_open',
  'worker_close',
  'load_packages',
  'validate_package',
  'package_loaded',
  'create_topic',
)

export const B_PROGRAM_IDENTIFIER = '🎛️' as const

export const PACKAGE_EXPORTS = keyMirror('templates', 'behaviors', 'skills')
