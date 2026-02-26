import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import type { EventLogRow } from '../../tools/memory/memory.types.ts'
import type { DiagnosticEntry } from '../agent.types.ts'
import {
  buildContextMessages,
  createInferenceCall,
  createTrajectoryRecorder,
  parseModelResponse,
} from '../agent.utils.ts'

// ============================================================================
// createInferenceCall
// ============================================================================

describe('createInferenceCall', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  test('appends /v1/chat/completions to baseUrl', async () => {
    let capturedUrl = ''
    globalThis.fetch = (async (url: string) => {
      capturedUrl = url
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }))
    }) as unknown as typeof fetch

    const call = createInferenceCall('http://localhost:8080')
    await call({ model: 'test', messages: [] })

    expect(capturedUrl).toBe('http://localhost:8080/v1/chat/completions')
  })

  test('POSTs JSON with Content-Type header', async () => {
    let capturedOpts: RequestInit | undefined
    globalThis.fetch = (async (_url: string, opts?: RequestInit) => {
      capturedOpts = opts
      return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }))
    }) as unknown as typeof fetch

    const call = createInferenceCall('http://localhost:8080')
    await call({ model: 'test', messages: [{ role: 'user', content: 'hi' }] })

    expect(capturedOpts).toBeDefined()
    expect(capturedOpts!.method).toBe('POST')
    expect((capturedOpts!.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })

  test('passes response body through on success', async () => {
    const body = { choices: [{ message: { content: 'hello' } }] }
    globalThis.fetch = mock(async () => new Response(JSON.stringify(body))) as unknown as typeof fetch

    const call = createInferenceCall('http://localhost:8080')
    const result = await call({ model: 'test', messages: [] })

    expect(result.choices[0]!.message.content).toBe('hello')
  })

  test('throws on non-ok HTTP response', async () => {
    globalThis.fetch = mock(
      async () => new Response('error', { status: 503, statusText: 'Service Unavailable' }),
    ) as unknown as typeof fetch

    const call = createInferenceCall('http://localhost:8080')
    await expect(call({ model: 'test', messages: [] })).rejects.toThrow('503 Service Unavailable')
  })

  test('throws on missing choices[0].message', async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ choices: [] }))) as unknown as typeof fetch

    const call = createInferenceCall('http://localhost:8080')
    await expect(call({ model: 'test', messages: [] })).rejects.toThrow('missing choices[0].message')
  })
})

// ============================================================================
// parseModelResponse
// ============================================================================

describe('parseModelResponse', () => {
  test('returns null thinking and empty toolCalls for empty choices', () => {
    const result = parseModelResponse({ choices: [] })
    expect(result.thinking).toBeNull()
    expect(result.toolCalls).toEqual([])
    expect(result.message).toBeNull()
  })

  test('extracts reasoning_content as thinking', () => {
    const result = parseModelResponse({
      choices: [{ message: { reasoning_content: 'deep thought', content: 'answer' } }],
    })
    expect(result.thinking).toBe('deep thought')
    expect(result.message).toBe('answer')
  })

  test('extracts <think> tag as thinking when no reasoning_content', () => {
    const result = parseModelResponse({
      choices: [{ message: { content: '<think>my reasoning</think>answer here' } }],
    })
    expect(result.thinking).toBe('my reasoning')
    expect(result.message).toBe('answer here')
  })

  test('does not strip <think> tags when reasoning_content is present', () => {
    const result = parseModelResponse({
      choices: [{ message: { reasoning_content: 'via field', content: '<think>via tag</think>answer' } }],
    })
    expect(result.thinking).toBe('via field')
    expect(result.message).toBe('<think>via tag</think>answer')
  })

  test('returns null message for whitespace-only content after think strip', () => {
    const result = parseModelResponse({
      choices: [{ message: { content: '<think>reasoning</think>   ' } }],
    })
    expect(result.thinking).toBe('reasoning')
    expect(result.message).toBeNull()
  })

  test('parses tool calls with valid JSON arguments', () => {
    const result = parseModelResponse({
      choices: [
        {
          message: {
            tool_calls: [
              {
                id: 'c1',
                function: { name: 'read_file', arguments: '{"path":"/app.ts"}' },
              },
            ],
          },
        },
      ],
    })
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0]!.name).toBe('read_file')
    expect(result.toolCalls[0]!.arguments).toEqual({ path: '/app.ts' })
  })

  test('falls back to { _raw } for invalid JSON arguments', () => {
    const result = parseModelResponse({
      choices: [
        {
          message: {
            tool_calls: [{ id: 'c1', function: { name: 'bash', arguments: 'not-json{' } }],
          },
        },
      ],
    })
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0]!.arguments).toEqual({ _raw: 'not-json{' })
  })

  test('accepts object arguments directly', () => {
    const result = parseModelResponse({
      choices: [
        {
          message: {
            tool_calls: [{ id: 'c1', function: { name: 'bash', arguments: { command: 'ls' } } }],
          },
        },
      ],
    })
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0]!.arguments).toEqual({ command: 'ls' })
  })

  test('skips tool calls missing id or function name', () => {
    const result = parseModelResponse({
      choices: [
        {
          message: {
            tool_calls: [
              { function: { name: 'bash', arguments: '{}' } },
              { id: 'c2' },
              { id: 'c3', function: { name: 'read_file', arguments: '{}' } },
            ],
          },
        },
      ],
    })
    expect(result.toolCalls).toHaveLength(1)
    expect(result.toolCalls[0]!.id).toBe('c3')
  })
})

// ============================================================================
// createTrajectoryRecorder
// ============================================================================

describe('createTrajectoryRecorder', () => {
  test('starts with empty steps', () => {
    const recorder = createTrajectoryRecorder()
    expect(recorder.getSteps()).toEqual([])
  })

  test('addThought appends a thought step', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addThought('thinking hard')
    const steps = recorder.getSteps()
    expect(steps).toHaveLength(1)
    expect(steps[0]!.type).toBe('thought')
    expect((steps[0] as { content: string }).content).toBe('thinking hard')
    expect(steps[0]!.timestamp).toBeGreaterThan(0)
  })

  test('addMessage appends a message step', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addMessage('hello world')
    const steps = recorder.getSteps()
    expect(steps).toHaveLength(1)
    expect(steps[0]!.type).toBe('message')
    expect((steps[0] as { content: string }).content).toBe('hello world')
  })

  test('addToolCall appends a tool_call step with all fields', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addToolCall({
      name: 'read_file',
      status: 'completed',
      input: { path: '/foo' },
      output: 'contents',
      duration: 42,
    })
    const steps = recorder.getSteps()
    expect(steps).toHaveLength(1)
    const step = steps[0]!
    expect(step.type).toBe('tool_call')
    expect(step).toHaveProperty('name', 'read_file')
    expect(step).toHaveProperty('input', { path: '/foo' })
    expect(step).toHaveProperty('output', 'contents')
    expect(step).toHaveProperty('duration', 42)
  })

  test('addToolCall omits undefined optional fields', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addToolCall({ name: 'bash', status: 'failed' })
    const step = recorder.getSteps()[0]!
    expect(step).not.toHaveProperty('input')
    expect(step).not.toHaveProperty('output')
    expect(step).not.toHaveProperty('duration')
  })

  test('addPlan appends a plan step', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addPlan([{ id: 's1', intent: 'read', tools: ['read_file'] }])
    const steps = recorder.getSteps()
    expect(steps).toHaveLength(1)
    expect(steps[0]!.type).toBe('plan')
  })

  test('stepId included when provided, omitted when not', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addThought('with id', 'step-1')
    recorder.addThought('without id')
    const steps = recorder.getSteps()
    expect(steps[0]).toHaveProperty('stepId', 'step-1')
    expect(steps[1]).not.toHaveProperty('stepId')
  })

  test('getSteps returns structuredClone — mutations do not affect internal state', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addThought('original')
    const steps = recorder.getSteps()
    // @ts-expect-error - mutating clone to test isolation
    steps[0].content = 'mutated'
    expect((recorder.getSteps()[0] as { content: string }).content).toBe('original')
  })

  test('reset clears all steps', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addThought('a')
    recorder.addMessage('b')
    recorder.reset()
    expect(recorder.getSteps()).toEqual([])
  })

  test('accumulates steps in insertion order', () => {
    const recorder = createTrajectoryRecorder()
    recorder.addThought('t1')
    recorder.addMessage('m1')
    recorder.addToolCall({ name: 'bash', status: 'completed' })
    recorder.addPlan([{ id: 's1', intent: 'test', tools: ['bash'] }])
    const steps = recorder.getSteps()
    expect(steps).toHaveLength(4)
    expect(steps[0]!.type).toBe('thought')
    expect(steps[1]!.type).toBe('message')
    expect(steps[2]!.type).toBe('tool_call')
    expect(steps[3]!.type).toBe('plan')
  })
})

// ============================================================================
// buildContextMessages — snapshot context (formatSelectionContext + formatDiagnostics)
// ============================================================================

describe('buildContextMessages — snapshot context', () => {
  /** Minimal EventLogRow stub — only fields used by formatSelectionContext */
  const row = (fields: Partial<EventLogRow>): EventLogRow =>
    ({
      id: 0,
      session_id: 'test',
      event_type: '',
      thread: '',
      selected: 0,
      trigger: 0,
      priority: 0,
      blocked_by: null,
      interrupts: null,
      detail: null,
      created_at: '',
      ...fields,
    }) as EventLogRow

  // ---------- formatSelectionContext (via buildContextMessages) ----------

  test('windows to last 10 selection steps', () => {
    // Build 12 selection steps — each step has one selected row
    const eventLog: EventLogRow[] = Array.from({ length: 12 }, (_, i) =>
      row({ event_type: `event_${i}`, thread: `t_${i}`, selected: 1, priority: i }),
    )

    const messages = buildContextMessages({ history: [], eventLog })
    const system = messages[0]!.content as string

    expect(system).toContain('(2 earlier selection steps omitted)')
    // event_0 and event_1 are in the first 2 steps (omitted)
    expect(system).not.toContain('thread: t_0')
    expect(system).not.toContain('thread: t_1,')
    // event_2 through event_11 are in the last 10 (kept)
    expect(system).toContain('event_2')
    expect(system).toContain('event_11')
  })

  test('no omission notice when <= 10 steps', () => {
    const eventLog = [row({ event_type: 'task', thread: 'trigger', selected: 1, priority: 0 })]

    const messages = buildContextMessages({ history: [], eventLog })
    const system = messages[0]!.content as string

    expect(system).toContain('## BP Selection History')
    expect(system).not.toContain('omitted')
  })

  test('groups blocked bids into their selection step', () => {
    // Two blocked bids followed by one selected — all form one step
    const eventLog = [
      row({ event_type: 'execute', thread: 'simulationGuard', selected: 0, blocked_by: 'simulationGuard' }),
      row({ event_type: 'execute', thread: 'symbolicSafetyNet', selected: 0, blocked_by: 'symbolicSafetyNet' }),
      row({ event_type: 'context_ready', thread: 'main', selected: 1, priority: 1 }),
    ]

    const messages = buildContextMessages({ history: [], eventLog })
    const system = messages[0]!.content as string

    expect(system).toContain('**Selected:** context_ready (thread: main, priority: 1)')
    expect(system).toContain('Blocked: execute (thread: simulationGuard) by simulationGuard')
    expect(system).toContain('Blocked: execute (thread: symbolicSafetyNet) by symbolicSafetyNet')
  })

  test('handles empty eventLog without adding section', () => {
    const messages = buildContextMessages({ history: [], eventLog: [] })
    const system = messages[0]!.content as string

    expect(system).not.toContain('BP Selection History')
  })

  // ---------- formatDiagnostics (via buildContextMessages) ----------

  test('formats feedback_error diagnostics', () => {
    const diagnostics: DiagnosticEntry[] = [
      { kind: 'feedback_error', type: 'execute', error: 'Handler threw TypeError', timestamp: 1 },
    ]

    const messages = buildContextMessages({ history: [], diagnostics })
    const system = messages[0]!.content as string

    expect(system).toContain('## BP Diagnostics')
    expect(system).toContain('ERROR: handler for "execute" threw: Handler threw TypeError')
  })

  test('formats restricted_trigger_error diagnostics', () => {
    const diagnostics: DiagnosticEntry[] = [
      { kind: 'restricted_trigger_error', type: 'task', error: 'Event restricted by public API', timestamp: 1 },
    ]

    const messages = buildContextMessages({ history: [], diagnostics })
    const system = messages[0]!.content as string

    expect(system).toContain('REJECTED: trigger for "task" — Event restricted by public API')
  })

  test('formats bthreads_warning diagnostics', () => {
    const diagnostics: DiagnosticEntry[] = [
      { kind: 'bthreads_warning', thread: 'maxIterations', warning: 'Thread already exists', timestamp: 1 },
    ]

    const messages = buildContextMessages({ history: [], diagnostics })
    const system = messages[0]!.content as string

    expect(system).toContain('WARNING: thread "maxIterations" — Thread already exists')
  })

  test('formats multiple diagnostics of mixed kinds', () => {
    const diagnostics: DiagnosticEntry[] = [
      { kind: 'feedback_error', type: 'simulate_request', error: 'Network timeout', timestamp: 1 },
      { kind: 'bthreads_warning', thread: 'taskGate', warning: 'Duplicate thread', timestamp: 2 },
      { kind: 'restricted_trigger_error', type: 'execute', error: 'Not in public events', timestamp: 3 },
    ]

    const messages = buildContextMessages({ history: [], diagnostics })
    const system = messages[0]!.content as string

    expect(system).toContain('ERROR: handler for "simulate_request" threw: Network timeout')
    expect(system).toContain('WARNING: thread "taskGate" — Duplicate thread')
    expect(system).toContain('REJECTED: trigger for "execute" — Not in public events')
  })

  test('empty diagnostics array does not add section', () => {
    const messages = buildContextMessages({ history: [], diagnostics: [] })
    const system = messages[0]!.content as string

    expect(system).not.toContain('BP Diagnostics')
  })

  // ---------- Combined: eventLog + diagnostics ----------

  test('includes both selection history and diagnostics when both provided', () => {
    const eventLog = [row({ event_type: 'task', thread: 'trigger', selected: 1, priority: 0 })]
    const diagnostics: DiagnosticEntry[] = [{ kind: 'feedback_error', type: 'execute', error: 'Boom', timestamp: 1 }]

    const messages = buildContextMessages({ history: [], eventLog, diagnostics })
    const system = messages[0]!.content as string

    expect(system).toContain('## BP Selection History')
    expect(system).toContain('**Selected:** task')
    expect(system).toContain('## BP Diagnostics')
    expect(system).toContain('ERROR: handler for "execute" threw: Boom')
  })
})
