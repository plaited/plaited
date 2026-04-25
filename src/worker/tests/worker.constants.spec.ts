import { describe, expect, test } from 'bun:test'
import { SESSION_EVENTS, WORKER_EVENTS, WORKER_MESSAGE } from '../worker.constants.ts'

describe('worker constants', () => {
  test('mirrors worker event names', () => {
    expect(WORKER_EVENTS).toEqual({
      run: 'run',
      setup: 'setup',
      cancel: 'cancel',
    })
  })

  test('pins worker message channel', () => {
    expect(WORKER_MESSAGE).toBe('worker_message')
  })

  test('mirrors all session event names used by the worker emitter bridge', () => {
    expect(SESSION_EVENTS).toEqual({
      agent_message_chunk: 'agent_message_chunk',
      agent_thought_chunk: 'agent_thought_chunk',
      tool_call: 'tool_call',
      tool_call_update: 'tool_call_update',
      plan: 'plan',
      available_commands_update: 'available_commands_update',
      current_mode_update: 'current_mode_update',
      user_message_chunk: 'user_message_chunk',
      config_option_update: 'config_option_update',
      session_info_update: 'session_info_update',
      error: 'error',
    })
  })
})
