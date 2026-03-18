import { describe, expect, test } from 'bun:test'
import { formatClaudeResultFailure } from '../claude-agent-sdk.ts'

describe('claude-agent-sdk', () => {
  test('formats sdk error results with subtype and errors', () => {
    const reason = formatClaudeResultFailure({
      type: 'result',
      subtype: 'error_max_turns',
      duration_ms: 1,
      duration_api_ms: 1,
      is_error: true,
      num_turns: 1,
      stop_reason: null,
      total_cost_usd: 0,
      usage: {
        input_tokens: 0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        output_tokens: 0,
        server_tool_use: { web_search_requests: 0, web_fetch_requests: 0 },
        service_tier: 'standard',
        cache_creation: {
          ephemeral_1h_input_tokens: 0,
          ephemeral_5m_input_tokens: 0,
        },
        inference_geo: '',
        iterations: [],
        speed: 'standard',
      },
      modelUsage: {},
      permission_denials: [],
      errors: ['permissions denied'],
      uuid: '00000000-0000-0000-0000-000000000000',
      session_id: '00000000-0000-0000-0000-000000000001',
    })

    expect(reason).toContain('subtype=error_max_turns')
    expect(reason).toContain('errors=permissions denied')
  })
})
