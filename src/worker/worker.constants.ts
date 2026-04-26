import { keyMirror } from '../utils.ts'

export const WORKER_MESSAGE = 'worker_message'

export const WORKER_EVENTS = keyMirror('run', 'setup', 'cancel')
