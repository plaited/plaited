import { describe, expect, test } from 'bun:test'

import { AGENT_EVENTS } from '../../agent/agent.constants.ts'
import type { AgentToolCall } from '../../agent/agent.schemas.ts'
import type { Model, ModelDelta } from '../../agent/agent.types.ts'
import { createAgent } from '../../agent/create-agent.ts'
import { createSimulationEvaluationFactory } from '../create-simulation-evaluation-factory.ts'

const createToolCall = (name: string, id = 'tc-1'): AgentToolCall => ({
  id,
  name,
  arguments: {},
})

describe('createSimulationEvaluationFactory', () => {
  test('approves a simulated tool call through eval_approved', async () => {
    const seen: string[] = []
    let resolveApproved!: () => void
    const approvedSeen = new Promise<void>((resolve) => {
      resolveApproved = resolve
    })

    const model: Model = {
      reason: async function* ({ messages }) {
        const systemMessage = messages[0]?.content ?? ''

        if (typeof systemMessage === 'string' && systemMessage.includes('simulation engine')) {
          yield {
            type: 'text_delta',
            content: 'PREDICTED OUTPUT:\nstdout ok\n\nPREDICTED CHANGES:\n- read a file',
          } satisfies ModelDelta
          return
        }

        yield {
          type: 'text_delta',
          content: 'SCORE: 0.9\nREASONING: safe and useful',
        } satisfies ModelDelta
      },
    }

    const agent = await createAgent({
      id: 'agent:test',
      factories: [
        createSimulationEvaluationFactory({
          model,
          getGoal: () => 'Read the file safely',
          getHistory: () => [],
        }),
        () => ({
          handlers: {
            [AGENT_EVENTS.eval_approved]() {
              seen.push('eval_approved')
              resolveApproved()
            },
          },
        }),
      ],
    })

    agent.restrictedTrigger({
      type: AGENT_EVENTS.simulate_request,
      detail: {
        toolCall: createToolCall('read_file'),
        tags: ['workspace'],
      },
    })

    await approvedSeen

    expect(seen).toEqual(['eval_approved'])
  })

  test('rejects when symbolic evaluation blocks the prediction', async () => {
    const seen: string[] = []
    let resolveRejected!: () => void
    const rejectedSeen = new Promise<void>((resolve) => {
      resolveRejected = resolve
    })

    const model: Model = {
      reason: async function* () {
        yield {
          type: 'text_delta',
          content: 'PREDICTED OUTPUT:\nrm -rf /\n\nPREDICTED CHANGES:\n- all files deleted',
        } satisfies ModelDelta
      },
    }

    const agent = await createAgent({
      id: 'agent:test',
      factories: [
        createSimulationEvaluationFactory({
          model,
          getGoal: () => 'Read the file safely',
          getHistory: () => [],
        }),
        () => ({
          handlers: {
            [AGENT_EVENTS.eval_rejected](detail) {
              const rejected = detail as { reason: string }
              seen.push(rejected.reason)
              resolveRejected()
            },
          },
        }),
      ],
    })

    agent.restrictedTrigger({
      type: AGENT_EVENTS.simulate_request,
      detail: {
        toolCall: createToolCall('bash'),
        tags: [],
      },
    })

    await rejectedSeen

    expect(seen).toHaveLength(1)
    expect(seen[0]?.includes('Blocked by pattern')).toBe(true)
  })
})
