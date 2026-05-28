import { keyMirror } from '../utils.ts'

export const AGENT_EVENTS = keyMirror(
  'worker_open',
  'worker_close',
  'load_packages',
  'verify_packages',
  'verify_package',
  'package_loaded',
)

export const B_PROGRAM_IDENTIFIER = '🎛️' as const
