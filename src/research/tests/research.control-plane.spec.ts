import { describe, expect, test } from 'bun:test'

import { type BPListener, behavioral, type SnapshotMessage } from '../../behavioral.ts'
import { replayToFrontier } from '../../cli/behavioral-frontier/behavioral-frontier.ts'
import { RESEARCH_EVENTS } from '../research.constants.ts'
import { addResearchControlPlane, createResearchControlProtocolThreads } from '../research.ts'

type RuntimeRole = 'analyst' | 'coder'

type SelectedEvent = {
  type: string
  runtime?: RuntimeRole
  taskId?: string
}

const waitForSettled = async () => {
  await Bun.sleep(20)
}

const collectSelectedEvents = ({
  useSnapshot,
}: {
  useSnapshot: (listener: (message: SnapshotMessage) => void | Promise<void>) => void
}) => {
  const selectedEvents: SelectedEvent[] = []

  useSnapshot((message) => {
    if (message.kind !== 'selection') {
      return
    }
    const selected = message.bids.find((bid) => bid.selected)
    if (!selected) {
      return
    }

    const detail = selected.detail
    const runtime =
      detail && typeof detail === 'object' && (detail as { runtime?: unknown }).runtime
        ? (detail as { runtime: RuntimeRole }).runtime
        : undefined
    const taskId =
      detail && typeof detail === 'object' && typeof (detail as { taskId?: unknown }).taskId === 'string'
        ? (detail as { taskId: string }).taskId
        : undefined

    selectedEvents.push({
      type: selected.type,
      ...(runtime ? { runtime } : {}),
      ...(taskId ? { taskId } : {}),
    })
  })

  return selectedEvents
}

const listenerMatchesRuntime = ({ listener, runtime }: { listener: BPListener; runtime: RuntimeRole }) => {
  if (!listener.detailSchema) {
    return true
  }
  return listener.detailSchema.safeParse({ runtime, taskId: `${runtime}-probe` }).success
}

const hasBlockForRuntime = ({
  pending,
  runtime,
  eventType,
}: {
  pending: ReturnType<typeof replayToFrontier>['pending']
  runtime: RuntimeRole
  eventType: string
}) => {
  for (const bid of pending.values()) {
    const block = bid.block
    const listeners = Array.isArray(block) ? block : block ? [block] : []
    if (listeners.some((listener) => listener.type === eventType && listenerMatchesRuntime({ listener, runtime }))) {
      return true
    }
  }
  return false
}

const hasModelRequestBlockForRuntime = ({
  pending,
  runtime,
}: {
  pending: ReturnType<typeof replayToFrontier>['pending']
  runtime: RuntimeRole
}) => hasBlockForRuntime({ pending, runtime, eventType: RESEARCH_EVENTS.model_request })

const hasTaskBlockForRuntime = ({
  pending,
  runtime,
}: {
  pending: ReturnType<typeof replayToFrontier>['pending']
  runtime: RuntimeRole
}) => hasBlockForRuntime({ pending, runtime, eventType: RESEARCH_EVENTS.task })

describe('research control plane', () => {
  test('supports happy-path task lifecycle through model request and final message', async () => {
    const runtime = behavioral()
    const selectedEvents = collectSelectedEvents(runtime)

    const modelRequests: string[] = []
    const { triggerResearchControlEvent } = addResearchControlPlane({
      runtime,
      invokeModel: async ({ request }) => {
        modelRequests.push(`${request.runtime}:${request.taskId}`)
        return {
          choices: [
            {
              message: { content: 'analysis complete' },
              finish_reason: 'stop',
            },
          ],
        }
      },
    })

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.task,
      detail: {
        taskId: 'task-1',
        runtime: 'analyst',
        prompt: 'Summarize the diff.',
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.context_ready,
      detail: {
        taskId: 'task-1',
        runtime: 'analyst',
        messages: [{ role: 'user', content: 'Summarize the diff.' }],
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.model_request,
      detail: {
        taskId: 'task-1',
        runtime: 'analyst',
        cause: 'initial',
      },
    })

    await waitForSettled()

    expect(modelRequests).toEqual(['analyst:task-1'])
    expect(selectedEvents.map((event) => event.type)).toEqual([
      RESEARCH_EVENTS.task,
      RESEARCH_EVENTS.context_ready,
      RESEARCH_EVENTS.model_request,
      RESEARCH_EVENTS.model_response,
      RESEARCH_EVENTS.message,
    ])
  })

  test('mixed model_response content + toolCalls keeps task active and accepts later tool_result', async () => {
    const runtime = behavioral()
    const selectedEvents = collectSelectedEvents(runtime)

    const { triggerResearchControlEvent } = addResearchControlPlane({
      runtime,
      invokeModel: async () => ({
        choices: [
          {
            message: {
              content: 'I will inspect the file now.',
              tool_calls: [
                {
                  id: 'tool-1',
                  type: 'function',
                  function: {
                    name: 'read_file',
                    arguments: '{"path":"README.md"}',
                  },
                },
              ],
            },
            finish_reason: 'tool_calls',
          },
        ],
      }),
    })

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.task,
      detail: {
        taskId: 'task-mixed',
        runtime: 'analyst',
        prompt: 'Inspect README and summarize.',
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.context_ready,
      detail: {
        taskId: 'task-mixed',
        runtime: 'analyst',
        messages: [{ role: 'user', content: 'Inspect README and summarize.' }],
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.model_request,
      detail: {
        taskId: 'task-mixed',
        runtime: 'analyst',
        cause: 'initial',
      },
    })

    await waitForSettled()

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.tool_result,
      detail: {
        taskId: 'task-mixed',
        runtime: 'analyst',
        toolCallId: 'tool-1',
        toolName: 'read_file',
        ok: true,
        result: { content: 'README contents' },
      },
    })

    await waitForSettled()

    expect(selectedEvents.map((event) => event.type)).toEqual([
      RESEARCH_EVENTS.task,
      RESEARCH_EVENTS.context_ready,
      RESEARCH_EVENTS.model_request,
      RESEARCH_EVENTS.model_response,
      RESEARCH_EVENTS.tool_intent,
      RESEARCH_EVENTS.message,
      RESEARCH_EVENTS.tool_result,
    ])
  })

  test('tool_result can drive a second model_request on the same active task', async () => {
    const runtime = behavioral()
    const selectedEvents = collectSelectedEvents(runtime)

    let invokeCount = 0
    const { triggerResearchControlEvent } = addResearchControlPlane({
      runtime,
      invokeModel: async () => {
        invokeCount += 1
        if (invokeCount === 1) {
          return {
            choices: [
              {
                message: {
                  content: 'Need tool output before final answer.',
                  tool_calls: [
                    {
                      id: 'tool-loop-1',
                      type: 'function',
                      function: {
                        name: 'read_file',
                        arguments: '{"path":"README.md"}',
                      },
                    },
                  ],
                },
                finish_reason: 'tool_calls',
              },
            ],
          }
        }
        return {
          choices: [
            {
              message: { content: 'Final answer after tool result.' },
              finish_reason: 'stop',
            },
          ],
        }
      },
    })

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.task,
      detail: {
        taskId: 'task-loop',
        runtime: 'analyst',
        prompt: 'Use a tool and then finish.',
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.context_ready,
      detail: {
        taskId: 'task-loop',
        runtime: 'analyst',
        messages: [{ role: 'user', content: 'Use a tool and then finish.' }],
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.model_request,
      detail: {
        taskId: 'task-loop',
        runtime: 'analyst',
        cause: 'initial',
      },
    })

    await waitForSettled()

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.tool_result,
      detail: {
        taskId: 'task-loop',
        runtime: 'analyst',
        toolCallId: 'tool-loop-1',
        toolName: 'read_file',
        ok: true,
        result: { content: 'README contents' },
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.model_request,
      detail: {
        taskId: 'task-loop',
        runtime: 'analyst',
        cause: 'after_tool',
      },
    })

    await waitForSettled()

    const expectedSequence = [
      RESEARCH_EVENTS.task,
      RESEARCH_EVENTS.context_ready,
      RESEARCH_EVENTS.model_request,
      RESEARCH_EVENTS.model_response,
      RESEARCH_EVENTS.tool_intent,
      RESEARCH_EVENTS.message,
      RESEARCH_EVENTS.tool_result,
      RESEARCH_EVENTS.model_request,
      RESEARCH_EVENTS.model_response,
      RESEARCH_EVENTS.message,
    ]

    expect(invokeCount).toBe(2)
    expect(selectedEvents.map((event) => event.type)).toEqual(expectedSequence)

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.tool_result,
      detail: {
        taskId: 'task-loop',
        runtime: 'analyst',
        toolCallId: 'tool-loop-stale',
        toolName: 'read_file',
        ok: true,
        result: { content: 'stale after terminal completion' },
      },
    })

    await waitForSettled()

    expect(selectedEvents.map((event) => event.type)).toEqual(expectedSequence)
  })

  test('non-terminal message does not end the active task', async () => {
    const runtime = behavioral()
    const selectedEvents = collectSelectedEvents(runtime)
    const { triggerResearchControlEvent } = addResearchControlPlane({ runtime })

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.task,
      detail: {
        taskId: 'task-message',
        runtime: 'coder',
        prompt: 'Continue after this message.',
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.message,
      detail: {
        taskId: 'task-message',
        runtime: 'coder',
        role: 'assistant',
        content: 'progress update only',
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.tool_result,
      detail: {
        taskId: 'task-message',
        runtime: 'coder',
        toolCallId: 'tool-2',
        toolName: 'read_file',
        ok: true,
        result: { content: 'still active' },
      },
    })

    await waitForSettled()

    expect(selectedEvents.map((event) => event.type)).toEqual([
      RESEARCH_EVENTS.task,
      RESEARCH_EVENTS.message,
      RESEARCH_EVENTS.tool_result,
    ])
  })

  test('terminal tool/system messages are rejected and do not close the task window', async () => {
    const runtime = behavioral()
    const selectedEvents = collectSelectedEvents(runtime)
    const runtimeErrors: string[] = []
    const { triggerResearchControlEvent } = addResearchControlPlane({ runtime })

    runtime.useSnapshot((message) => {
      if (message.kind === 'runtime_error') {
        runtimeErrors.push(message.error)
      }
    })

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.task,
      detail: {
        taskId: 'task-terminal-role',
        runtime: 'coder',
        prompt: 'Stay active until assistant terminal output.',
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.message,
      detail: {
        taskId: 'task-terminal-role',
        runtime: 'coder',
        role: 'tool',
        content: 'tool output',
        terminal: true,
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.tool_result,
      detail: {
        taskId: 'task-terminal-role',
        runtime: 'coder',
        toolCallId: 'tool-3',
        toolName: 'read_file',
        ok: true,
        result: { content: 'still active after rejected terminal tool message' },
      },
    })

    await waitForSettled()

    expect(selectedEvents.map((event) => event.type)).toEqual([RESEARCH_EVENTS.task, RESEARCH_EVENTS.tool_result])
    expect(runtimeErrors).toHaveLength(1)
    expect(runtimeErrors[0]).toContain('research_control_event')
    expect(runtimeErrors[0]).toContain('terminal=true is only valid for assistant messages')
  })

  test('blocks stale tool_result after terminal model_response closes task', async () => {
    const runtime = behavioral()
    const selectedEvents = collectSelectedEvents(runtime)

    const { triggerResearchControlEvent } = addResearchControlPlane({
      runtime,
      invokeModel: async () => ({
        choices: [
          {
            message: { content: 'done' },
            finish_reason: 'stop',
          },
        ],
      }),
    })

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.task,
      detail: {
        taskId: 'task-terminal',
        runtime: 'coder',
        prompt: 'Write test cases.',
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.context_ready,
      detail: {
        taskId: 'task-terminal',
        runtime: 'coder',
        messages: [{ role: 'user', content: 'Write test cases.' }],
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.model_request,
      detail: {
        taskId: 'task-terminal',
        runtime: 'coder',
        cause: 'initial',
      },
    })

    await waitForSettled()

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.tool_result,
      detail: {
        taskId: 'task-terminal',
        runtime: 'coder',
        toolCallId: 'tool-stale',
        toolName: 'read_file',
        ok: true,
        result: { content: 'stale' },
      },
    })

    await waitForSettled()

    expect(selectedEvents.map((event) => event.type)).toEqual([
      RESEARCH_EVENTS.task,
      RESEARCH_EVENTS.context_ready,
      RESEARCH_EVENTS.model_request,
      RESEARCH_EVENTS.model_response,
      RESEARCH_EVENTS.message,
    ])
  })

  test('analyst and coder task windows progress independently', async () => {
    const runtime = behavioral()
    const selectedEvents = collectSelectedEvents(runtime)

    const modelRequests: string[] = []
    const { triggerResearchControlEvent } = addResearchControlPlane({
      runtime,
      invokeModel: async ({ request }) => {
        modelRequests.push(`${request.runtime}:${request.taskId}`)
        return {
          choices: [
            {
              message: { content: 'coder done' },
              finish_reason: 'stop',
            },
          ],
        }
      },
    })

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.task,
      detail: {
        taskId: 'task-analyst',
        runtime: 'analyst',
        prompt: 'Stay active while coder runs.',
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.task,
      detail: {
        taskId: 'task-coder',
        runtime: 'coder',
        prompt: 'Run independently.',
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.context_ready,
      detail: {
        taskId: 'task-coder',
        runtime: 'coder',
        messages: [{ role: 'user', content: 'Run independently.' }],
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.model_request,
      detail: {
        taskId: 'task-coder',
        runtime: 'coder',
        cause: 'initial',
      },
    })

    await waitForSettled()

    const taskRuntimes = selectedEvents
      .filter((event) => event.type === RESEARCH_EVENTS.task)
      .map((event) => event.runtime)

    expect(taskRuntimes).toEqual(['analyst', 'coder'])
    expect(modelRequests).toEqual(['coder:task-coder'])
    expect(
      selectedEvents.some((event) => event.type === RESEARCH_EVENTS.model_request && event.runtime === 'coder'),
    ).toBe(true)
  })

  test('reports malformed payloads and protocol violations via snapshots, not synthetic events', async () => {
    const runtime = behavioral()
    const selectedEvents = collectSelectedEvents(runtime)
    const runtimeErrors: string[] = []
    let contractViolationEvents = 0

    runtime.useSnapshot((message) => {
      if (message.kind === 'runtime_error') {
        runtimeErrors.push(message.error)
      }
    })

    runtime.addHandler(RESEARCH_EVENTS.contract_violation, () => {
      contractViolationEvents += 1
    })

    const { triggerResearchControlEvent } = addResearchControlPlane({ runtime })

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.task,
      detail: {
        taskId: 'task-violations',
        runtime: 'analyst',
        prompt: 'diagnostics',
      },
    })

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.approval,
      detail: {
        taskId: 'wrong-task-id',
        runtime: 'analyst',
        approved: true,
      },
    })

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.tool_result,
      detail: {
        taskId: 'task-violations',
        runtime: 'analyst',
        toolName: 'run_shell',
        ok: true,
        result: { stdout: 'missing call id' },
      },
    })

    await waitForSettled()

    expect(runtimeErrors).toHaveLength(2)
    expect(runtimeErrors.some((error) => error.includes(RESEARCH_EVENTS.approval))).toBe(true)
    expect(runtimeErrors.some((error) => error.includes('research_control_event'))).toBe(true)
    expect(contractViolationEvents).toBe(0)
    expect(selectedEvents.map((event) => event.type)).not.toContain(RESEARCH_EVENTS.contract_violation)
  })

  test('public control API rejects direct contract_violation injection', async () => {
    const runtime = behavioral()
    const selectedEvents = collectSelectedEvents(runtime)
    const runtimeErrors: string[] = []
    const { triggerResearchControlEvent } = addResearchControlPlane({ runtime })

    runtime.useSnapshot((message) => {
      if (message.kind === 'runtime_error') {
        runtimeErrors.push(message.error)
      }
    })

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.contract_violation,
      detail: {
        eventType: RESEARCH_EVENTS.task,
        reason: 'injected',
        issues: ['should not be accepted by control API'],
      },
    })

    await waitForSettled()

    expect(selectedEvents.map((event) => event.type)).not.toContain(RESEARCH_EVENTS.contract_violation)
    expect(runtimeErrors).toHaveLength(1)
    expect(runtimeErrors[0]).toContain('research_control_event')
    expect(runtimeErrors[0]).toContain('type: Invalid input')
  })

  test('spec-driven context gate blocks model_request until context_ready', async () => {
    const runtime = behavioral()
    const selectedEvents = collectSelectedEvents(runtime)

    let modelRequestCount = 0
    const { triggerResearchControlEvent } = addResearchControlPlane({
      runtime,
      invokeModel: async () => {
        modelRequestCount += 1
        return {
          choices: [
            {
              message: { content: 'ok' },
              finish_reason: 'stop',
            },
          ],
        }
      },
    })

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.task,
      detail: {
        taskId: 'task-4',
        runtime: 'analyst',
        prompt: 'gate check',
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.model_request,
      detail: {
        taskId: 'task-4',
        runtime: 'analyst',
        cause: 'initial',
      },
    })

    await waitForSettled()

    expect(selectedEvents.map((event) => event.type)).toEqual([RESEARCH_EVENTS.task])

    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.context_ready,
      detail: {
        taskId: 'task-4',
        runtime: 'analyst',
        messages: [{ role: 'user', content: 'gate check' }],
      },
    })
    triggerResearchControlEvent({
      type: RESEARCH_EVENTS.model_request,
      detail: {
        taskId: 'task-4',
        runtime: 'analyst',
        cause: 'initial',
      },
    })

    await waitForSettled()

    expect(modelRequestCount).toBe(1)
    expect(selectedEvents.map((event) => event.type)).toContain(RESEARCH_EVENTS.model_request)
  })

  test('replay reconstructs lane-scoped model_request blocks', () => {
    const threads = createResearchControlProtocolThreads()

    const analystOnly = replayToFrontier({
      threads,
      history: [
        {
          type: RESEARCH_EVENTS.task,
          source: 'trigger',
          detail: {
            taskId: 'task-analyst',
            runtime: 'analyst',
            prompt: 'analyst',
          },
        },
      ],
    })

    expect(hasModelRequestBlockForRuntime({ pending: analystOnly.pending, runtime: 'analyst' })).toBe(true)
    expect(hasTaskBlockForRuntime({ pending: analystOnly.pending, runtime: 'analyst' })).toBe(true)
    expect(hasTaskBlockForRuntime({ pending: analystOnly.pending, runtime: 'coder' })).toBe(false)

    const bothLanes = replayToFrontier({
      threads,
      history: [
        {
          type: RESEARCH_EVENTS.task,
          source: 'trigger',
          detail: {
            taskId: 'task-analyst',
            runtime: 'analyst',
            prompt: 'analyst',
          },
        },
        {
          type: RESEARCH_EVENTS.task,
          source: 'trigger',
          detail: {
            taskId: 'task-coder',
            runtime: 'coder',
            prompt: 'coder',
          },
        },
      ],
    })

    expect(hasModelRequestBlockForRuntime({ pending: bothLanes.pending, runtime: 'analyst' })).toBe(true)
    expect(hasModelRequestBlockForRuntime({ pending: bothLanes.pending, runtime: 'coder' })).toBe(true)

    const analystReady = replayToFrontier({
      threads,
      history: [
        {
          type: RESEARCH_EVENTS.task,
          source: 'trigger',
          detail: {
            taskId: 'task-analyst',
            runtime: 'analyst',
            prompt: 'analyst',
          },
        },
        {
          type: RESEARCH_EVENTS.task,
          source: 'trigger',
          detail: {
            taskId: 'task-coder',
            runtime: 'coder',
            prompt: 'coder',
          },
        },
        {
          type: RESEARCH_EVENTS.context_ready,
          source: 'trigger',
          detail: {
            taskId: 'task-analyst',
            runtime: 'analyst',
            messages: [{ role: 'user', content: 'ready' }],
          },
        },
      ],
    })

    expect(hasModelRequestBlockForRuntime({ pending: analystReady.pending, runtime: 'analyst' })).toBe(false)
    expect(hasModelRequestBlockForRuntime({ pending: analystReady.pending, runtime: 'coder' })).toBe(true)
  })
})
