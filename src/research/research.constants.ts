import { keyMirror } from '../utils.ts'

export const RESEARCH_EVENTS = keyMirror(
  'approval',
  'check_health',
  'contract_violation',
  'context_ready',
  'execute',
  'message',
  'model_request',
  'model_response',
  'serve',
  'start',
  'stop',
  'task',
  'tool_intent',
  'tool_result',
  'vllm_ready',
)

export const ANALYST_PORT = '8001'
export const CODER_PORT = '8002'

export const ANALYST_MODEL = 'google/gemma-4-31B-it'
export const CODER_MODEL = 'google/gemma-4-26B-A4B-it'
