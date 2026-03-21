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
    expect(parsed.capture.source).toBe('codex-cli')
    expect(parsed.capture.format).toBe('jsonl-event-stream')
    expect(parsed.capture.messageCount).toBe(1)
    expect(parsed.trajectory).toEqual([
      expect.objectContaining({
        type: 'message',
        content: 'hello world',
      }),
    ])
  })

  test('captures reasoning and tool items as rich evidence', () => {
    const parsed = parseCodexExecJsonl(
      [
        JSON.stringify({ type: 'thread.started', thread_id: 't1' }),
        JSON.stringify({ type: 'turn.started' }),
        JSON.stringify({
          type: 'item.completed',
          item: { id: 'i-think', type: 'reasoning', text: 'inspect the slice first' },
        }),
        JSON.stringify({
          type: 'item.completed',
          item: { id: 'i-tool', type: 'tool_call', name: 'rg', status: 'completed', input: 'src/improve' },
        }),
        JSON.stringify({
          type: 'item.completed',
          item: { id: 'i-msg', type: 'agent_message', text: 'done' },
        }),
      ].join('\n'),
    )

    expect(parsed.capture.thoughtCount).toBe(1)
    expect(parsed.capture.toolCallCount).toBe(1)
    expect(parsed.capture.itemTypes).toEqual(['agent_message', 'reasoning', 'tool_call'])
    expect(parsed.trajectory).toEqual([
      expect.objectContaining({ type: 'thought', content: 'inspect the slice first' }),
      expect.objectContaining({ type: 'tool_call', name: 'rg', status: 'completed' }),
      expect.objectContaining({ type: 'message', content: 'done' }),
    ])
  })

  test('treats command execution items as rich capture and preserves raw events', () => {
    const parsed = parseCodexExecJsonl(
      [
        JSON.stringify({ type: 'thread.started', thread_id: 't1' }),
        JSON.stringify({ type: 'turn.started' }),
        JSON.stringify({
          type: 'item.completed',
          item: {
            id: 'i-cmd',
            type: 'command_execution',
            command: 'sed',
            argv: ['-n', '1,20p', 'README.md'],
            status: 'completed',
            stdout: 'file content',
            exit_code: 0,
            duration_ms: 42,
          },
        }),
        JSON.stringify({
          type: 'item.completed',
          item: { id: 'i-msg', type: 'agent_message', text: 'done' },
        }),
      ].join('\n'),
    )

    expect(parsed.capture.toolCallCount).toBe(1)
    expect(parsed.capture.itemTypes).toEqual(['agent_message', 'command_execution'])
    expect(parsed.capture.metadata).toEqual(
      expect.objectContaining({
        threadId: 't1',
        turnCount: 1,
        rawEvents: expect.any(Array),
      }),
    )
    expect(parsed.trajectory).toEqual([
      expect.objectContaining({
        type: 'tool_call',
        name: 'command_execution',
        status: 'completed',
        input: { command: 'sed', argv: ['-n', '1,20p', 'README.md'] },
        output: { stdout: 'file content', exitCode: 0 },
        duration: 42,
      }),
      expect.objectContaining({ type: 'message', content: 'done' }),
    ])
  })
})
