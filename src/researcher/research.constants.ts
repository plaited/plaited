import { keyMirror } from '../utils.ts'

export const RESEARCHER_COMMAND = 'research'

export const DEFAULT_RESEARCH_CONTEXT_WORKER_ID = 'researcher-context-worker'
export const DEFAULT_RESEARCH_CONSUMER_WORKER_ID = 'researcher-consumer-worker'
export const DEFAULT_RESEARCH_REVIEW_WORKER_ID = 'researcher-review-worker'
export const DEFAULT_RESEARCH_OBSERVATION_PATH = '.plaited/researcher/observations.jsonl'
export const DEFAULT_RESEARCH_TIMEOUT_MS = 60_000

export const CONTEXT_PROMPT_MARKER = 'MODEL_A_CONTEXT_ASSEMBLER'
export const CONSUMER_PROMPT_MARKER = 'MODEL_B_CONSUMER'
export const REVIEW_PROMPT_MARKER = 'MODEL_A_REVIEWER'

export const RESEARCH_EVENTS = keyMirror(
  'research_task',
  'context_worker_setup',
  'context_worker_run',
  'context_worker_result',
  'consumer_worker_setup',
  'consumer_worker_run',
  'consumer_worker_result',
  'grade_request',
  'grade_result',
  'observation_write',
  'research_done',
  'research_error',
)
