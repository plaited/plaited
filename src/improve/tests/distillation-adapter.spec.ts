import { afterAll, describe, expect, test } from 'bun:test'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import type { Model, ModelDelta } from '../../agent/agent.types.ts'
import type { ToolDefinition } from '../../agent/agent.schemas.ts'
import { createLocalAdapter } from '../distillation-adapter.ts'

const createMockModel = (
  responses: Array<{ toolCalls?: Array<{ id: string; name: string; arguments: string }>; text?: string }>,
): Model => {
  let callCount = 0
  return {
    reason: async function* () {
      const response = responses[callCount] ?? responses[responses.length - 1]!
      callCount++

      if (response.text) {
        yield { type: 'text_delta', content: response.text } as ModelDelta
      }

      if (response.toolCalls) {
        for (const toolCall of response.toolCalls) {
          yield {
            type: 'toolcall_delta',
            id: toolCall.id,
            name: toolCall.name,
            arguments: toolCall.arguments,
          } as ModelDelta
        }
      }

      yield {
        type: 'done',
        response: { usage: { inputTokens: 100, outputTokens: 25 } },
      } as ModelDelta
    },
  }
}

const workspaceTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_file',
    description: 'Read a file',
    parameters: {
      type: 'object',
      properties: { path: { type: 'string' } },
      required: ['path'],
    },
  },
  tags: ['workspace'],
}

describe('createLocalAdapter', () => {
  const memoryPath = join(tmpdir(), `plaited-distill-${crypto.randomUUID()}`)

  afterAll(() => {
    rmSync(memoryPath, { recursive: true, force: true })
  })

  test('runs a prompt through the agent loop and returns structured output', async () => {
    mkdirSync(memoryPath, { recursive: true })

    const adapter = createLocalAdapter({
      model: createMockModel([
        { toolCalls: [{ id: 'tc-1', name: 'read_file', arguments: '{"path":"main.ts"}' }] },
        { text: 'Read complete.' },
      ]),
      tools: [workspaceTool],
      toolExecutor: async () => 'file contents',
      memoryPath,
      maxIterations: 2,
    })

    const result = await adapter({ prompt: 'Read main.ts' })

    expect(result.output).toBe('Read complete.')
    expect(result.exitCode).toBe(0)
    expect(result.timedOut).toBeUndefined()
    expect(result.timing?.inputTokens).toBe(100)
    expect(result.timing?.outputTokens).toBe(25)
    expect(result.trajectory?.some((step) => step.type === 'tool_call' && step.status === 'completed')).toBe(true)
    expect(result.trajectory?.some((step) => step.type === 'message' && step.content === 'Read complete.')).toBe(true)
  })

  test('supports repeated invocations without leaking session state', async () => {
    mkdirSync(memoryPath, { recursive: true })

    const adapter = createLocalAdapter({
      model: createMockModel([{ text: 'Hello there.' }, { text: 'Second run.' }]),
      tools: [],
      toolExecutor: async () => '',
      memoryPath,
      maxIterations: 1,
    })

    const first = await adapter({ prompt: 'Hi' })
    const second = await adapter({ prompt: 'Again' })

    expect(first.output).toBe('Hello there.')
    expect(second.output).toBe('Second run.')
    expect(first.exitCode).toBe(0)
    expect(second.exitCode).toBe(0)
  })
})
