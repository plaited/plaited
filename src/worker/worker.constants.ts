import { keyMirror } from '../utils.ts'

export const WORKER_EVENTS = keyMirror('shell', 'write', 'read')

export const WORKER_PATH = `${import.meta.dir}/worker.ts`
