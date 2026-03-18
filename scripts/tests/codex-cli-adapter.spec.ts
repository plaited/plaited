import { describe, expect, test } from 'bun:test'
import { parseCodexExecJsonl } from '../codex-cli-adapter.ts'

describe('parseCodexExecJsonl', () => {
  test('extracts final message and usage from codex exec jsonl', () => {
    const parsed = parseCodexExecJsonl(
      [
        JSON.stringify({ type: 'thread.started', thread_id: 't1' }),
        JSON.stringify({ type: 'turn.started' }),
        JSON.stringify({
          type: 'item.completed',
          item: { id: 'i1', type: 'agent_message', text: 'hello world' },
        }),
        JSON.stringify({
          type: 'turn.completed',
          usage: { input_tokens: 12, cached_input_tokens: 4, output_tokens: 7 },
        }),
      ].join('\n'),
    )

    expect(parsed.output).toBe('hello world')
    expect(parsed.inputTokens).toBe(12)
    expect(parsed.outputTokens).toBe(7)
    expect(parsed.trajectory).toEqual([
      expect.objectContaining({
        type: 'message',
        content: 'hello world',
      }),
    ])
  })
})
