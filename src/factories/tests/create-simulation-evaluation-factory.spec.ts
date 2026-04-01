import { describe, expect, test } from 'bun:test'

import { AGENT_EVENTS } from '../../agent/agent.constants.ts'
import type { AgentToolCall } from '../../agent/agent.schemas.ts'
import type { ChatMessage, Model, ModelDelta } from '../../agent/agent.types.ts'
import { createAgent } from '../../agent/create-agent.ts'
import {
  createSimulationEvaluationFactory,
  parsePrediction,
  STATE_TRANSITION_PROMPT,
} from '../create-simulation-evaluation-factory.ts'

const TEST_WORKSPACE = process.cwd()

const createToolCall = (name: string, id = 'tc-1'): AgentToolCall => ({
  id,
  name,
  arguments: {},
})

const createErrorModel = (errorMsg: string): Model => ({
  reason: async function* () {
    yield { type: 'error' as const, error: errorMsg }
  },
})

const createChunkedModel = (chunks: string[]): Model => ({
  reason: async function* () {
    for (const chunk of chunks) {
      yield { type: 'text_delta' as const, content: chunk }
    }
    yield { type: 'done' as const, response: { usage: { inputTokens: 10, outputTokens: 5 } } }
  },
})

describe('parsePrediction', () => {
  test('extracts predicted changes from formatted output', () => {
    const text = `PREDICTED OUTPUT:
File written successfully.

PREDICTED CHANGES:
- Created file /src/main.ts with 42 lines
- Modified package.json to add dependency`

    const result = parsePrediction(text)
    expect(result.predictedOutput).toBe(text)
    expect(result.predictedChanges).toEqual([
      'Created file /src/main.ts with 42 lines',
      'Modified package.json to add dependency',
    ])
  })

  test('returns empty changes when no PREDICTED CHANGES section', () => {
    const text = 'The command would print "hello world" to stdout.'
    const result = parsePrediction(text)
    expect(result.predictedOutput).toBe(text)
    expect(result.predictedChanges).toEqual([])
  })

  test('returns empty changes when PREDICTED CHANGES has no bullet items', () => {
    const text = `PREDICTED OUTPUT:
Success

PREDICTED CHANGES:
No changes expected.`

    const result = parsePrediction(text)
    expect(result.predictedChanges).toEqual([])
  })
})

describe('simulation prompt behavior', () => {
  const toolCall: AgentToolCall = {
    id: 'tc-prompt',
    name: 'write_file',
    arguments: { path: '/src/main.ts', content: 'console.log("hello")' },
  }

  const history: ChatMessage[] = [
    { role: 'user', content: 'Create a hello world file' },
    { role: 'assistant', content: 'I will create the file for you.' },
  ]

  test('uses the state transition prompt and passes history to the model', async () => {
    let capturedMessages: ChatMessage[] = []
    const model: Model = {
      reason: async function* ({ messages, signal: _signal }) {
        if (!capturedMessages.length) {
          capturedMessages = messages
        }
        yield { type: 'text_delta' as const, content: 'PREDICTED OUTPUT:\nSuccess' }
        yield { type: 'done' as const, response: { usage: { inputTokens: 10, outputTokens: 5 } } }
      },
    }

    const agent = await createAgent({
      id: 'agent:simulation-prompt',
      cwd: TEST_WORKSPACE,
      workspace: TEST_WORKSPACE,
      factories: [
        createSimulationEvaluationFactory({
          model,
          getGoal: () => 'Create the file safely',
          getHistory: () => history,
        }),
      ],
    })

    agent.trigger({
      type: AGENT_EVENTS.simulate_request,
      detail: {
        toolCall,
        tags: [],
      },
    })

    await Bun.sleep(0)

    expect(capturedMessages).toHaveLength(4)
    expect(capturedMessages[0]!.role).toBe('system')
    expect(capturedMessages[0]!.content).toBe(STATE_TRANSITION_PROMPT)
    expect(capturedMessages[1]!.role).toBe('user')
    expect(capturedMessages[2]!.role).toBe('assistant')
    expect(capturedMessages[3]!.role).toBe('user')
    expect(capturedMessages[3]!.content).toContain('write_file')
    expect(capturedMessages[3]!.content).toContain('/src/main.ts')
  })

  test('uses temperature 0 for deterministic simulation requests', async () => {
    let capturedTemp: number | undefined
    const model: Model = {
      reason: async function* ({ temperature, signal: _signal }) {
        capturedTemp = temperature
        yield { type: 'text_delta' as const, content: 'PREDICTED OUTPUT:\nSuccess' }
        yield { type: 'done' as const, response: { usage: { inputTokens: 10, outputTokens: 5 } } }
      },
    }

    const agent = await createAgent({
      id: 'agent:simulation-temp',
      cwd: TEST_WORKSPACE,
      workspace: TEST_WORKSPACE,
      factories: [
        createSimulationEvaluationFactory({
          model,
          getGoal: () => 'Create the file safely',
          getHistory: () => history,
        }),
      ],
    })

    agent.trigger({
      type: AGENT_EVENTS.simulate_request,
      detail: {
        toolCall,
        tags: [],
      },
    })

    await Bun.sleep(0)

    expect(capturedTemp).toBe(0)
  })

  test('collects chunked simulation output and can still approve', async () => {
    let resolveApproved!: () => void
    const approvedSeen = new Promise<void>((resolve) => {
      resolveApproved = resolve
    })

    const simulationModel = createChunkedModel([
      'PREDICTED OUTPUT:\n',
      'Command succeeded.\n\n',
      'PREDICTED CHANGES:\n',
      '- File created\n',
      '- Dependencies installed',
    ])

    let callCount = 0
    const model: Model = {
      reason: async function* (args) {
        const current = callCount++
        if (current === 0) {
          yield* simulationModel.reason(args)
          return
        }

        yield { type: 'text_delta' as const, content: 'SCORE: 0.9\nREASONING: safe and useful' }
      },
    }

    const agent = await createAgent({
      id: 'agent:simulation-chunked',
      cwd: TEST_WORKSPACE,
      workspace: TEST_WORKSPACE,
      factories: [
        createSimulationEvaluationFactory({
          model,
          getGoal: () => 'Create the file safely',
          getHistory: () => [],
        }),
        () => ({
          handlers: {
            [AGENT_EVENTS.eval_approved]() {
              resolveApproved()
            },
          },
        }),
      ],
    })

    agent.trigger({
      type: AGENT_EVENTS.simulate_request,
      detail: {
        toolCall,
        tags: [],
      },
    })

    await approvedSeen
  })

  test('simulation failures flow through eval_rejected', async () => {
    let rejectedReason = ''
    let resolveRejected!: () => void
    const rejectedSeen = new Promise<void>((resolve) => {
      resolveRejected = resolve
    })

    const model = createErrorModel('Inference timeout')

    const agent = await createAgent({
      id: 'agent:simulation-error',
      cwd: TEST_WORKSPACE,
      workspace: TEST_WORKSPACE,
      factories: [
        createSimulationEvaluationFactory({
          model,
          getGoal: () => 'Create the file safely',
          getHistory: () => [],
        }),
        () => ({
          handlers: {
            [AGENT_EVENTS.eval_rejected](detail) {
              rejectedReason = (detail as { reason: string }).reason
              resolveRejected()
            },
          },
        }),
      ],
    })

    agent.trigger({
      type: AGENT_EVENTS.simulate_request,
      detail: {
        toolCall,
        tags: [],
      },
    })

    await rejectedSeen

    expect(rejectedReason).toContain('Simulation failed')
    expect(rejectedReason).toContain('Inference timeout')
  })

  test('formats tool call arguments as JSON in the simulation prompt', async () => {
    let capturedMessages: ChatMessage[] = []
    const model: Model = {
      reason: async function* ({ messages, signal: _signal }) {
        if (!capturedMessages.length) {
          capturedMessages = messages
        }
        yield { type: 'text_delta' as const, content: 'PREDICTED OUTPUT:\nSuccess' }
        yield { type: 'done' as const, response: { usage: { inputTokens: 10, outputTokens: 5 } } }
      },
    }

    const agent = await createAgent({
      id: 'agent:simulation-args',
      cwd: TEST_WORKSPACE,
      workspace: TEST_WORKSPACE,
      factories: [
        createSimulationEvaluationFactory({
          model,
          getGoal: () => 'Create the file safely',
          getHistory: () => [],
        }),
      ],
    })

    agent.trigger({
      type: AGENT_EVENTS.simulate_request,
      detail: {
        toolCall: {
          id: 'tc-bash',
          name: 'bash',
          arguments: { command: 'ls -la' },
        },
        tags: [],
      },
    })

    await Bun.sleep(0)

    const lastMessage = capturedMessages[capturedMessages.length - 1]!
    expect(lastMessage.content).toContain('Tool: bash')
    expect(lastMessage.content).toContain('"command": "ls -la"')
  })
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
      cwd: TEST_WORKSPACE,
      workspace: TEST_WORKSPACE,
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

    agent.trigger({
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
      cwd: TEST_WORKSPACE,
      workspace: TEST_WORKSPACE,
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

    agent.trigger({
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
