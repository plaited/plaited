import { keyMirror } from '../utils.ts'

export const AGENT_EVENTS = keyMirror('start')

export const DEFAULT_POLICY = {
  temperature: 1.0,
  topP: 0.95,
  topK: 64,
  maxCompletionTokens: 1024,
}
