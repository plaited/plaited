import { describe, expect, test } from 'bun:test'

import { AGENT_EVENTS } from '../../agent/agent.constants.ts'
import type { Model } from '../../agent/agent.types.ts'
import { createAgent } from '../../agent/create-agent.ts'
import { createInferenceFactory } from '../create-inference-factory.ts'

describe('createInferenceFactory', () => {
  test('streams deltas and emits model_response through createAgent', async () => {
    const seen: Array<string> = []
    let resolveModelResponse!: () => void
    const modelResponseSeen = new Promise<void>((resolve) => {
      resolveModelResponse = resolve
    })

    const model: Model = {
      async *reason() {
        yield { type: 'thinking_delta', content: 'thinking' }
        yield { type: 'text_delta', content: 'hello' }
        yield { type: 'text_delta', content: ' world' }
        yield {
          type: 'done',
          response: { usage: { inputTokens: 2, outputTokens: 3 } },
        }
      },
    }

    const agent = await createAgent({
      id: 'agent:test',
      factories: [
        createInferenceFactory({
          model,
          buildContext: () => ({
            messages: [{ role: 'user', content: 'hi' }],
          }),
        }),
        () => ({
          handlers: {
            [AGENT_EVENTS.thinking_delta](detail) {
              seen.push(`thinking:${(detail as { content: string }).content}`)
            },
            [AGENT_EVENTS.text_delta](detail) {
              seen.push(`text:${(detail as { content: string }).content}`)
            },
            [AGENT_EVENTS.model_response](detail) {
              const parsed = (detail as { parsed: { message: string | null } }).parsed
              seen.push(`response:${parsed.message}`)
              resolveModelResponse()
            },
          },
        }),
      ],
    })

    agent.restrictedTrigger({ type: AGENT_EVENTS.invoke_inference })
    await modelResponseSeen

    expect(seen).toEqual(['thinking:thinking', 'text:hello', 'text: world', 'response:hello world'])
  })

  test('emits a message after non-retryable inference errors', async () => {
    let resolveMessage!: () => void
    const messageSeen = new Promise<void>((resolve) => {
      resolveMessage = resolve
    })
    const seen: string[] = []

    const model: Model = {
      async *reason() {
        yield { type: 'error', error: 'bad upstream' }
      },
    }

    const agent = await createAgent({
      id: 'agent:test',
      factories: [
        createInferenceFactory({
          model,
          buildContext: () => ({
            messages: [{ role: 'user', content: 'hi' }],
          }),
        }),
        () => ({
          handlers: {
            [AGENT_EVENTS.message](detail) {
              seen.push((detail as { content: string }).content)
              resolveMessage()
            },
          },
        }),
      ],
    })

    agent.restrictedTrigger({ type: AGENT_EVENTS.invoke_inference })
    await messageSeen

    expect(seen).toEqual(['Inference error: bad upstream'])
  })
})
