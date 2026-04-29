import { describe, expect, test } from 'bun:test'

import type { BPEvent } from '../../behavioral/behavioral.schemas.ts'
import {
  AdapterToolEventJsonSchema,
  AdapterToolExecutionDetailJsonSchema,
  AdapterToolExecutionEventJsonSchema,
  AdapterToolExecutionEventSchema,
  AdapterToolResultDetailJsonSchema,
  AdapterToolResultEventJsonSchema,
  AdapterToolResultEventSchema,
  AdapterVllmInferDetailJsonSchema,
  AdapterVllmInferDetailSchema,
} from '../adapters.schemas.ts'
import { mapBPEventsToVllmMessages } from '../policy-vllm.ts'

describe('adapters schemas', () => {
  test('tool_execution schema accepts replay-safe detail payload', () => {
    const parsed = AdapterToolExecutionEventSchema.safeParse({
      type: 'tool_execution',
      detail: {
        taskId: 'task-1',
        runtime: 'analyst',
        toolCallId: 'call-1',
        toolName: 'read_file',
        arguments: '{"path":"README.md"}',
      },
    })

    expect(parsed.success).toBe(true)
  })

  test('tool_result schema enforces ok/result and error coupling', () => {
    const validFailure = AdapterToolResultEventSchema.safeParse({
      type: 'tool_result',
      detail: {
        taskId: 'task-1',
        runtime: 'analyst',
        toolCallId: 'call-1',
        toolName: 'read_file',
        ok: false,
        error: 'file not found',
      },
    })
    expect(validFailure.success).toBe(true)

    const missingResult = AdapterToolResultEventSchema.safeParse({
      type: 'tool_result',
      detail: {
        taskId: 'task-1',
        runtime: 'analyst',
        toolCallId: 'call-1',
        toolName: 'read_file',
        ok: true,
      },
    })
    expect(missingResult.success).toBe(false)

    const missingError = AdapterToolResultEventSchema.safeParse({
      type: 'tool_result',
      detail: {
        taskId: 'task-1',
        runtime: 'analyst',
        toolCallId: 'call-1',
        toolName: 'read_file',
        ok: false,
      },
    })
    expect(missingError.success).toBe(false)

    const contradictorySuccess = AdapterToolResultEventSchema.safeParse({
      type: 'tool_result',
      detail: {
        taskId: 'task-1',
        runtime: 'analyst',
        toolCallId: 'call-1',
        toolName: 'read_file',
        ok: true,
        result: { content: 'ok' },
        error: 'should not exist',
      },
    })
    expect(contradictorySuccess.success).toBe(false)

    const contradictoryFailure = AdapterToolResultEventSchema.safeParse({
      type: 'tool_result',
      detail: {
        taskId: 'task-1',
        runtime: 'analyst',
        toolCallId: 'call-1',
        toolName: 'read_file',
        ok: false,
        error: 'failed',
        result: { content: 'should not exist' },
      },
    })
    expect(contradictoryFailure.success).toBe(false)
  })

  test('tool_result detail JSON schema encodes conditional requirements', () => {
    expect(AdapterToolResultDetailJsonSchema.oneOf).toHaveLength(2)
    expect(AdapterToolResultDetailJsonSchema.oneOf[0]).toEqual({
      properties: { ok: { const: true } },
      required: ['result'],
      not: { required: ['error'] },
    })
    expect(AdapterToolResultDetailJsonSchema.oneOf[1]).toEqual({
      properties: { ok: { const: false } },
      required: ['error'],
      not: { required: ['result'] },
    })
  })

  test('event-level JSON schemas are replay-safe envelopes', () => {
    expect(AdapterToolExecutionEventJsonSchema).toEqual({
      type: 'object',
      required: ['type', 'detail'],
      properties: {
        type: { const: 'tool_execution' },
        detail: AdapterToolExecutionDetailJsonSchema,
      },
      additionalProperties: false,
    })

    expect(AdapterToolResultEventJsonSchema).toEqual({
      type: 'object',
      required: ['type', 'detail'],
      properties: {
        type: { const: 'tool_result' },
        detail: AdapterToolResultDetailJsonSchema,
      },
      additionalProperties: false,
    })

    expect(AdapterToolEventJsonSchema).toEqual({
      oneOf: [AdapterToolExecutionEventJsonSchema, AdapterToolResultEventJsonSchema],
    })
  })

  test('infer detail schema accepts multimodal messages, tools, and thinking options', () => {
    const parsed = AdapterVllmInferDetailSchema.safeParse({
      runtime: 'analyst',
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Inspect these media items.' },
            { type: 'image_url', image_url: { url: 'https://example.com/a.png' } },
            { type: 'video_url', video_url: { url: 'https://example.com/a.mp4' } },
          ],
        },
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: 'read_file',
            parameters: { type: 'object', properties: { path: { type: 'string' } } },
          },
        },
      ],
      thinking: true,
      reasoningMode: 'thinking',
      chatTemplateKwargs: { custom: 'value' },
    })

    expect(parsed.success).toBe(true)
  })

  test('infer detail schema requires one of prompt/prompts/inputs/messages', () => {
    const parsed = AdapterVllmInferDetailSchema.safeParse({
      runtime: 'coder',
      thinking: true,
    })
    expect(parsed.success).toBe(false)
    expect(AdapterVllmInferDetailJsonSchema.anyOf).toEqual([
      { required: ['prompt'] },
      { required: ['prompts'] },
      { required: ['inputs'] },
      { required: ['messages'] },
    ])
  })
})

describe('mapBPEventsToVllmMessages', () => {
  test('maps task, tool_execution, and tool_result into vLLM messages', () => {
    const events: BPEvent[] = [
      {
        type: 'task',
        detail: {
          taskId: 'task-1',
          prompt: 'Summarize README.md',
        },
      },
      {
        type: 'tool_execution',
        detail: {
          taskId: 'task-1',
          runtime: 'analyst',
          toolCallId: 'call-1',
          toolName: 'read_file',
          arguments: '{"path":"README.md"}',
        },
      },
      {
        type: 'tool_result',
        detail: {
          taskId: 'task-1',
          runtime: 'analyst',
          toolCallId: 'call-1',
          toolName: 'read_file',
          ok: true,
          result: {
            content: 'README body',
          },
        },
      },
    ]

    const messages = mapBPEventsToVllmMessages({
      events,
      systemPrompt: 'You are analyst runtime.',
      promptEventTypes: ['task'],
    })

    expect(messages).toHaveLength(4)
    expect(messages[0]).toEqual({
      role: 'system',
      content: 'You are analyst runtime.',
    })
    expect(messages[1]?.role).toBe('user')
    expect(messages[2]?.role).toBe('assistant')
    expect(messages[3]).toEqual({
      role: 'tool',
      content: '{"content":"README body"}',
      tool_call_id: 'call-1',
      name: 'read_file',
    })
  })

  test('can include unmapped events as user messages', () => {
    const events: BPEvent[] = [{ type: 'progress', detail: { pct: 50 } }, { type: 'note' }]

    const messages = mapBPEventsToVllmMessages({
      events,
      includeUnmappedAsUser: true,
    })

    expect(messages).toEqual([
      { role: 'user', content: 'progress: {"pct":50}' },
      { role: 'user', content: 'note' },
    ])
  })

  test('canonicalizes nested JSON payloads deterministically', () => {
    const eventA: BPEvent = {
      type: 'task',
      detail: {
        meta: {
          z: 1,
          a: {
            b: 2,
            a: 1,
          },
        },
      },
    }
    const eventB: BPEvent = {
      type: 'task',
      detail: {
        meta: {
          a: {
            a: 1,
            b: 2,
          },
          z: 1,
        },
      },
    }

    const messagesA = mapBPEventsToVllmMessages({ events: [eventA], promptEventTypes: ['task'] })
    const messagesB = mapBPEventsToVllmMessages({ events: [eventB], promptEventTypes: ['task'] })

    expect(messagesA[0]?.content).toBe(messagesB[0]?.content)
    expect(messagesA[0]?.content).toBe('task: {"meta":{"a":{"a":1,"b":2},"z":1}}')
  })
})
