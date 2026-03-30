import { describe, expect, test } from 'bun:test'

import { AGENT_EVENTS, RISK_TAG } from '../../agent/agent.constants.ts'
import type { AgentToolCall } from '../../agent/agent.schemas.ts'
import { createAgent } from '../../agent/create-agent.ts'
import { createGateExecuteFactory } from '../create-gate-execute-factory.ts'

const workspaceTool = {
  type: 'function' as const,
  function: {
    name: 'read_file',
    parameters: {
      type: 'object' as const,
    },
  },
  tags: [RISK_TAG.workspace],
}

const untaggedTool = {
  type: 'function' as const,
  function: {
    name: 'bash',
    parameters: {
      type: 'object' as const,
    },
  },
}

const createToolCall = (name: string, id = 'tc-1'): AgentToolCall => ({
  id,
  name,
  arguments: {},
})

describe('createGateExecuteFactory', () => {
  test('routes workspace-only tools directly to execute and tool_result', async () => {
    const seen: string[] = []
    let resolveToolResult!: () => void
    const toolResultSeen = new Promise<void>((resolve) => {
      resolveToolResult = resolve
    })

    const agent = await createAgent({
      id: 'agent:test',
      factories: [
        createGateExecuteFactory({
          tools: [workspaceTool],
          async toolExecutor() {
            return { ok: true }
          },
        }),
        () => ({
          handlers: {
            [AGENT_EVENTS.gate_approved]() {
              seen.push('gate_approved')
            },
            [AGENT_EVENTS.execute]() {
              seen.push('execute')
            },
            [AGENT_EVENTS.tool_result](detail) {
              const result = (detail as { result: { status: string } }).result
              seen.push(`tool_result:${result.status}`)
              resolveToolResult()
            },
          },
        }),
      ],
    })

    agent.restrictedTrigger({
      type: AGENT_EVENTS.context_ready,
      detail: { toolCall: createToolCall('read_file') },
    })

    await toolResultSeen

    expect(seen).toContain('gate_approved')
    expect(seen).toContain('execute')
    expect(seen).toContain('tool_result:completed')
  })

  test('routes non-workspace tools to simulate_request', async () => {
    const seen: string[] = []
    let resolveSimulate!: () => void
    const simulateSeen = new Promise<void>((resolve) => {
      resolveSimulate = resolve
    })

    const agent = await createAgent({
      id: 'agent:test',
      factories: [
        createGateExecuteFactory({
          tools: [untaggedTool],
          async toolExecutor() {
            return null
          },
        }),
        () => ({
          handlers: {
            [AGENT_EVENTS.gate_approved]() {
              seen.push('gate_approved')
            },
            [AGENT_EVENTS.simulate_request]() {
              seen.push('simulate_request')
              resolveSimulate()
            },
          },
        }),
      ],
    })

    agent.restrictedTrigger({
      type: AGENT_EVENTS.context_ready,
      detail: { toolCall: createToolCall('bash') },
    })

    await simulateSeen

    expect(seen).toContain('gate_approved')
    expect(seen).toContain('simulate_request')
  })

  test('rejects constitution-blocked tool calls', async () => {
    const seen: string[] = []
    let resolveRejected!: () => void
    const rejectedSeen = new Promise<void>((resolve) => {
      resolveRejected = resolve
    })

    const agent = await createAgent({
      id: 'agent:test',
      factories: [
        createGateExecuteFactory({
          tools: [workspaceTool],
          async toolExecutor() {
            return null
          },
          constitutionPredicates: [
            {
              name: 'no_reads',
              check(toolCall) {
                return toolCall.name === 'read_file'
              },
            },
          ],
        }),
        () => ({
          handlers: {
            [AGENT_EVENTS.gate_rejected](detail) {
              const rejected = detail as { decision: { reason?: string } }
              seen.push(`gate_rejected:${rejected.decision.reason}`)
              resolveRejected()
            },
          },
        }),
      ],
    })

    agent.restrictedTrigger({
      type: AGENT_EVENTS.context_ready,
      detail: { toolCall: createToolCall('read_file') },
    })

    await rejectedSeen

    expect(seen).toEqual(['gate_rejected:Blocked by no_reads'])
  })
})
