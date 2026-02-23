import { keyMirror } from '../utils/key-mirror.ts'

export const ORCHESTRATOR_EVENTS = keyMirror('dispatch', 'project_result', 'project_error', 'shutdown')
