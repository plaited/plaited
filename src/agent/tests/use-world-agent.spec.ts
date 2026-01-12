import { describe, expect, mock, test } from 'bun:test'
import { useSignal } from 'plaited'
import type { Trigger } from '../../main/behavioral.types.ts'
import { bSync, bThread } from '../../main/behavioral.utils.ts'
import type {
  AgentOutEvent,
  FunctionCall,
  InferenceModel,
  ToolRegistry,
  ToolResult,
  ToolSchema,
} from '../agent.types.ts'
import { createCodeExecutor } from '../code-executor.ts'
import { createContextBudget } from '../context-budget.ts'
import { createWorldAgent, useWorldAgent } from '../use-world-agent.ts'

/**
 * Test suite for useWorldAgent factory.
 * Verifies protocol-agnostic world agent with signal-based communication.
 */

// ============================================================================
// Test Fixtures
// ============================================================================

/**
 * Creates a trigger that collects events into an array.
 * Used for testing signal communication.
 */
const createCollectorTrigger = <T>(collector: T[]): Trigger => {
  return ((event: { type: string; detail: T }) => {
    collector.push(event.detail)
  }) as Trigger
}

const createMockToolRegistry = (): ToolRegistry => {
  const handlers = new Map<string, (args: Record<string, unknown>) => Promise<ToolResult>>()
  const schemas: ToolSchema[] = []

  return {
    register(name, handler, schema) {
      handlers.set(name, handler)
      schemas.push(schema)
    },
    async execute(call) {
      const handler = handlers.get(call.name)
      if (!handler) {
        return { success: true, data: 'executed' }
      }
      try {
        const args = JSON.parse(call.arguments)
        return await handler(args)
      } catch (error) {
        return { success: false, error: String(error) }
      }
    },
    schemas,
  }
}

const createMockModel = (toolCalls: FunctionCall[] = []): InferenceModel => ({
  inference: mock(async () => toolCalls),
})

// ============================================================================
// Initialization Tests
// ============================================================================

describe('useWorldAgent initialization', () => {
  test('creates agent with required config', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()

    const { trigger, outbound } = await useWorldAgent({
      tools,
      model,
    })

    expect(trigger).toBeDefined()
    expect(typeof trigger).toBe('function')
    expect(outbound).toBeDefined()
  })

  test('exposes public events: generate, cancel, feedback, disconnect', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()

    const { trigger } = await useWorldAgent({
      tools,
      model,
    })

    // These should not throw (public events)
    expect(() => trigger({ type: 'generate', detail: { intent: 'test' } })).not.toThrow()
    expect(() => trigger({ type: 'cancel' })).not.toThrow()
    expect(() =>
      trigger({
        type: 'feedback',
        detail: { result: { passed: true, a11yPassed: true, totalAssertions: 0, passedAssertions: 0, errors: [] } },
      }),
    ).not.toThrow()
    expect(() => trigger({ type: 'disconnect' })).not.toThrow()
  })
})

// ============================================================================
// Signal Communication Tests
// ============================================================================

describe('useWorldAgent signal communication', () => {
  test('emits events via outbound signal', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()
    const received: AgentOutEvent[] = []

    const { trigger, outbound } = await useWorldAgent({
      tools,
      model,
    })

    // Listen to outbound signal
    outbound.listen('agentEvent', createCollectorTrigger(received))

    // Trigger generation
    trigger({ type: 'generate', detail: { intent: 'create a button' } })

    // Should have emitted at least a thought event
    expect(received.length).toBeGreaterThan(0)
    expect(received[0]?.kind).toBe('thought')
  })
})

// ============================================================================
// Disconnect Tests
// ============================================================================

describe('useWorldAgent disconnect', () => {
  test('disconnect event triggers cleanup', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()

    const { trigger } = await useWorldAgent({
      tools,
      model,
    })

    // Should not throw
    expect(() => trigger({ type: 'disconnect' })).not.toThrow()
  })
})

// ============================================================================
// createWorldAgent Factory Tests
// ============================================================================

describe('createWorldAgent factory', () => {
  test('creates a behavioral program factory', () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()

    const factory = createWorldAgent({ tools, model })
    expect(typeof factory).toBe('function')
  })

  test('factory creates agent with trigger function', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()
    const outbound = useSignal<AgentOutEvent>()

    const factory = createWorldAgent({ tools, model })
    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    expect(typeof trigger).toBe('function')
  })

  test('supports customHandlers', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()
    const outbound = useSignal<AgentOutEvent>()
    let customCalled = false

    const factory = createWorldAgent({
      tools,
      model,
      customHandlers: {
        generate: async () => {
          customCalled = true
        },
      },
    })

    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    trigger({ type: 'generate', detail: { intent: 'test' } })

    // Give async handler time to execute
    await new Promise((resolve) => setTimeout(resolve, 50))
    expect(customCalled).toBe(true)
  })

  test('supports customBThreads', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()
    const outbound = useSignal<AgentOutEvent>()

    const customConstraint = bThread([bSync({ waitFor: 'customEvent' })])

    const factory = createWorldAgent({
      tools,
      model,
      customBThreads: {
        customConstraint,
      },
    })

    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    expect(typeof trigger).toBe('function')
  })

  test('supports preferences for hybrid UI', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()
    const outbound = useSignal<AgentOutEvent>()

    const factory = createWorldAgent({
      tools,
      model,
      preferences: {
        preferredBlocks: ['card'],
        preferredGroupings: ['list'],
      },
    })

    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    expect(typeof trigger).toBe('function')
  })

  test('supports skipTier2 constraint option', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()
    const outbound = useSignal<AgentOutEvent>()

    const factory = createWorldAgent({
      tools,
      model,
      constraints: {
        skipTier2: true,
      },
    })

    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    expect(typeof trigger).toBe('function')
  })
})

// ============================================================================
// Tool Execution Tests
// ============================================================================

describe('useWorldAgent tool execution', () => {
  test('executes tools from model inference', async () => {
    const tools = createMockToolRegistry()
    let toolCalled = false

    tools.register(
      'writeTemplate',
      async () => {
        toolCalled = true
        return { success: true, data: { content: '<button>Test</button>' } }
      },
      {
        name: 'writeTemplate',
        description: 'Write a template',
        parameters: { type: 'object', properties: {} },
      },
    )

    const model = createMockModel([{ name: 'writeTemplate', arguments: '{}' }])
    const outbound = useSignal<AgentOutEvent>()

    const factory = createWorldAgent({ tools, model })
    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    trigger({ type: 'generate', detail: { intent: 'test' } })

    await new Promise((resolve) => setTimeout(resolve, 100))
    expect(toolCalled).toBe(true)
  })

  test('emits toolCall event before execution', async () => {
    const tools = createMockToolRegistry()
    tools.register('testTool', async () => ({ success: true }), {
      name: 'testTool',
      description: 'Test',
      parameters: { type: 'object', properties: {} },
    })

    const model = createMockModel([{ name: 'testTool', arguments: '{}' }])
    const outbound = useSignal<AgentOutEvent>()
    const events: AgentOutEvent[] = []

    // Use proper trigger signature - listen returns { type, detail }
    outbound.listen('agentEvent', createCollectorTrigger(events))

    const factory = createWorldAgent({ tools, model })
    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    trigger({ type: 'generate', detail: { intent: 'test' } })

    await new Promise((resolve) => setTimeout(resolve, 100))

    const toolCalls = events.filter((e) => e.kind === 'toolCall')
    expect(toolCalls.length).toBeGreaterThan(0)
  })

  test('emits toolResult event after execution', async () => {
    const tools = createMockToolRegistry()
    tools.register('testTool', async () => ({ success: true, data: { result: 'ok' } }), {
      name: 'testTool',
      description: 'Test',
      parameters: { type: 'object', properties: {} },
    })

    const model = createMockModel([{ name: 'testTool', arguments: '{}' }])
    const outbound = useSignal<AgentOutEvent>()
    const events: AgentOutEvent[] = []

    outbound.listen('agentEvent', createCollectorTrigger(events))

    const factory = createWorldAgent({ tools, model })
    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    trigger({ type: 'generate', detail: { intent: 'test' } })

    await new Promise((resolve) => setTimeout(resolve, 100))

    const toolResults = events.filter((e) => e.kind === 'toolResult')
    expect(toolResults.length).toBeGreaterThan(0)
  })

  test('handles tool execution errors', async () => {
    const tools = createMockToolRegistry()
    const model: InferenceModel = {
      inference: async () => {
        throw new Error('Model error')
      },
    }
    const outbound = useSignal<AgentOutEvent>()
    const events: AgentOutEvent[] = []

    outbound.listen('agentEvent', createCollectorTrigger(events))

    const factory = createWorldAgent({ tools, model })
    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    trigger({ type: 'generate', detail: { intent: 'test' } })

    await new Promise((resolve) => setTimeout(resolve, 100))

    const errors = events.filter((e) => e.kind === 'error')
    expect(errors.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// Constraint Tests
// ============================================================================

describe('useWorldAgent constraints', () => {
  test('registers workflow constraint bThreads', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()
    const outbound = useSignal<AgentOutEvent>()

    const factory = createWorldAgent({ tools, model })
    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    // Factory should register constraints without error
    expect(typeof trigger).toBe('function')
  })

  test('registers preference constraints when provided', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()
    const outbound = useSignal<AgentOutEvent>()

    const factory = createWorldAgent({
      tools,
      model,
      preferences: {
        preferredBlocks: ['card'],
      },
    })

    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    expect(typeof trigger).toBe('function')
  })
})

// ============================================================================
// Handler Tests
// ============================================================================

describe('generate handler', () => {
  test('emits thought event', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()
    const outbound = useSignal<AgentOutEvent>()
    const events: AgentOutEvent[] = []

    outbound.listen('agentEvent', createCollectorTrigger(events))

    const factory = createWorldAgent({ tools, model })
    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    trigger({ type: 'generate', detail: { intent: 'create button' } })

    await new Promise((resolve) => setTimeout(resolve, 50))

    const thoughts = events.filter((e) => e.kind === 'thought')
    expect(thoughts.length).toBeGreaterThan(0)
    expect(thoughts[0]?.content).toContain('create button')
  })
})

describe('chainTools handler', () => {
  test('executes tools sequentially when sequential=true', async () => {
    const tools = createMockToolRegistry()
    const executionOrder: string[] = []

    tools.register(
      'tool1',
      async () => {
        executionOrder.push('tool1')
        return { success: true }
      },
      { name: 'tool1', description: 'Tool 1', parameters: { type: 'object', properties: {} } },
    )

    tools.register(
      'tool2',
      async () => {
        executionOrder.push('tool2')
        return { success: true }
      },
      { name: 'tool2', description: 'Tool 2', parameters: { type: 'object', properties: {} } },
    )

    const model = createMockModel()
    const outbound = useSignal<AgentOutEvent>()

    const factory = createWorldAgent({ tools, model })
    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    trigger({
      type: 'chainTools',
      detail: {
        calls: [
          { name: 'tool1', arguments: '{}' },
          { name: 'tool2', arguments: '{}' },
        ],
        sequential: true,
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 100))

    expect(executionOrder).toEqual(['tool1', 'tool2'])
  })
})

describe('feedback handler', () => {
  test('accepts feedback without error', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()
    const outbound = useSignal<AgentOutEvent>()

    const factory = createWorldAgent({ tools, model })
    const trigger = await factory({
      outbound,
      tools,
      model,
      contextBudget: createContextBudget(),
      codeExecutor: createCodeExecutor({ tools }),
    })

    expect(() =>
      trigger({
        type: 'feedback',
        detail: {
          result: {
            passed: true,
            a11yPassed: true,
            totalAssertions: 5,
            passedAssertions: 5,
            errors: [],
          },
        },
      }),
    ).not.toThrow()
  })
})
