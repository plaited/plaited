import { keyMirror } from '../utils.ts'

export const WORKER_COMMAND_TYPES = keyMirror('exec', 'write', 'read')

export const WORKER_MESSAGE_TYPES = keyMirror('exec_result', 'read_result', 'write_result', 'runtime_error')

export const WORKER_PATH = `${import.meta.dir}/worker.ts`
