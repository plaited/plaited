import { describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { AGENT_EVENTS, RISK_TAG } from '../../agent/agent.constants.ts'
import type { AgentToolCall } from '../../agent/agent.schemas.ts'
import { createAgent } from '../../agent/create-agent.ts'
import { createGateExecuteFactory } from '../create-gate-execute-factory.ts'

const TEST_WORKSPACE = process.cwd()

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

const createToolCall = (name: string, id = 'tc-1', arguments_: Record<string, unknown> = {}): AgentToolCall => ({
  id,
  name,
  arguments: arguments_,
})

describe('createGateExecuteFactory', () => {
  test('routes workspace-only tools directly to execute and tool_result', async () => {
    const seen: string[] = []
    const workspace = await mkdtemp(join(tmpdir(), 'gate-execute-'))
    await Bun.write(join(workspace, 'hello.txt'), 'hello from gate execute')
    let resolveToolResult!: () => void
    const toolResultSeen = new Promise<void>((resolve) => {
      resolveToolResult = resolve
    })

    const agent = await createAgent({
      id: 'agent:test',
      cwd: workspace,
      workspace: TEST_WORKSPACE,
      factories: [
        createGateExecuteFactory({
          tools: [workspaceTool],
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

    agent.trigger({
      type: AGENT_EVENTS.context_ready,
      detail: { toolCall: createToolCall('read_file', 'tc-1', { path: 'hello.txt' }) },
    })

    await toolResultSeen

    expect(seen).toContain('gate_approved')
    expect(seen).toContain('execute')
    expect(seen).toContain('tool_result:completed')

    await rm(workspace, { recursive: true, force: true })
  })

  test('routes non-workspace tools to simulate_request', async () => {
    const seen: string[] = []
    let resolveSimulate!: () => void
    const simulateSeen = new Promise<void>((resolve) => {
      resolveSimulate = resolve
    })

    const agent = await createAgent({
      id: 'agent:test',
      cwd: TEST_WORKSPACE,
      workspace: TEST_WORKSPACE,
      factories: [
        createGateExecuteFactory({
          tools: [untaggedTool],
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

    agent.trigger({
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
      cwd: TEST_WORKSPACE,
      workspace: TEST_WORKSPACE,
      factories: [
        createGateExecuteFactory({
          tools: [workspaceTool],
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

    agent.trigger({
      type: AGENT_EVENTS.context_ready,
      detail: { toolCall: createToolCall('read_file') },
    })

    await rejectedSeen

    expect(seen).toEqual(['gate_rejected:Blocked by no_reads'])
  })
})
