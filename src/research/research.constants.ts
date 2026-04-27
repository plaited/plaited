import { keyMirror } from '../utils.ts'

export const RESEARCH_EVENTS = keyMirror(
  'check_health',
  'context_ready',
  'execute',
  'serve',
  'start',
  'stop',
  'vllm_ready',
)

export const ANALYST_PORT = '8001'
export const CODER_PORT = '8002'
