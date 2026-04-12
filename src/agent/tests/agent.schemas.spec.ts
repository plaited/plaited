import { describe, expect, test } from 'bun:test'
import {
  AgentPlanStepSchema,
  AgentToolCallSchema,
  DecisionStepSchema,
  ModelUsageSchema,
  ModuleResultSchema,
  RequestBashDetailSchema,
  ToolDefinitionSchema,
  TrajectoryStepSchema,
  UpdateModuleModuleSchema,
} from 'plaited/agent'
import { bSync } from 'plaited/behavioral'
import * as z from 'zod'

describe('AgentToolCallSchema', () => {
  test('validates a complete tool call', () => {
    const result = AgentToolCallSchema.parse({
      id: 'tc-1',
      name: 'read_file',
      arguments: { path: 'src/main.ts' },
    })
    expect(result.id).toBe('tc-1')
    expect(result.name).toBe('read_file')
    expect(result.arguments).toEqual({ path: 'src/main.ts' })
  })

  test('validates glob_files arguments', () => {
    const result = AgentToolCallSchema.parse({
      id: 'tc-2',
      name: 'glob_files',
      arguments: { pattern: '**/*.ts' },
    })
    expect(result.arguments).toEqual({ pattern: '**/*.ts' })
  })

  test('rejects missing id', () => {
    expect(() => AgentToolCallSchema.parse({ name: 'read_file', arguments: {} })).toThrow()
  })

  test('rejects missing name', () => {
    expect(() => AgentToolCallSchema.parse({ id: 'tc-1', arguments: {} })).toThrow()
  })

  test('rejects invalid tool arguments for a known tool', () => {
    expect(() =>
      AgentToolCallSchema.parse({
        id: 'tc-3',
        name: 'bash',
        arguments: { path: 'worker.ts', args: 'not-an-array' },
      }),
    ).toThrow()
  })
})

describe('AgentPlanStepSchema', () => {
  test('defaults depends to undefined when omitted', () => {
    const result = AgentPlanStepSchema.parse({
      id: 's1',
      intent: 'Read files',
      tools: ['read_file'],
    })
    expect(result.depends).toBeUndefined()
  })
})

describe('TrajectoryStepSchema', () => {
  test('validates a thought step', () => {
    const result = TrajectoryStepSchema.parse({
      type: 'thought',
      content: 'Analyzing the code...',
      timestamp: Date.now(),
    })
    expect(result.type).toBe('thought')
  })

  test('validates a message step', () => {
    const result = TrajectoryStepSchema.parse({
      type: 'message',
      content: 'Here is the result',
      timestamp: Date.now(),
    })
    expect(result.type).toBe('message')
  })

  test('validates a tool_call step', () => {
    const result = TrajectoryStepSchema.parse({
      type: 'tool_call',
      name: 'read_file',
      status: 'completed',
      input: { path: '/main.ts' },
      output: 'file contents',
      duration: 42,
      timestamp: Date.now(),
    })
    expect(result.type).toBe('tool_call')
  })

  test('validates a plan step', () => {
    const result = TrajectoryStepSchema.parse({
      type: 'plan',
      entries: [{ id: 's1', intent: 'Read', tools: ['read_file'] }],
      timestamp: Date.now(),
    })
    expect(result.type).toBe('plan')
  })

  test('rejects unknown step type', () => {
    expect(() =>
      TrajectoryStepSchema.parse({
        type: 'unknown',
        content: 'test',
        timestamp: Date.now(),
      }),
    ).toThrow()
  })

  test('validates a decision step with bids', () => {
    const result = TrajectoryStepSchema.parse({
      type: 'decision',
      bids: [
        {
          thread: { label: 'taskGate', id: 'taskGate' },
          source: 'request',
          selected: true,
          type: 'task',
          priority: 0,
        },
        {
          thread: { label: 'noRmRf', id: 'noRmRf' },
          source: 'request',
          selected: false,
          type: 'execute',
          priority: 1,
          blockedBy: { label: 'noRmRf', id: 'noRmRf' },
        },
      ],
      timestamp: Date.now(),
    })
    expect(result.type).toBe('decision')
  })

  test('validates a decision step with empty bids', () => {
    const result = TrajectoryStepSchema.parse({
      type: 'decision',
      bids: [],
      timestamp: Date.now(),
    })
    expect(result.type).toBe('decision')
  })

  test('accepts optional stepId on all types', () => {
    const thought = TrajectoryStepSchema.parse({
      type: 'thought',
      content: 'test',
      timestamp: Date.now(),
      stepId: 'step-1',
    })
    expect(thought.stepId).toBe('step-1')
  })
})

describe('DecisionStepSchema', () => {
  test('validates complete bid with all fields', () => {
    const result = DecisionStepSchema.parse({
      type: 'decision',
      bids: [
        {
          thread: { label: 'sim_guard_tc-1', id: 'sim_guard_tc-1' },
          source: 'request',
          selected: false,
          type: 'execute',
          detail: { toolCall: { id: 'tc-1' } },
          priority: 2,
          blockedBy: { label: 'sim_guard_tc-1', id: 'sim_guard_tc-1' },
          interrupts: { label: 'batchCompletion', id: 'batchCompletion' },
        },
      ],
      timestamp: Date.now(),
      stepId: 'decision-1',
    })
    expect(result.bids).toHaveLength(1)
    expect(result.bids[0]!.blockedBy).toEqual({ label: 'sim_guard_tc-1', id: 'sim_guard_tc-1' })
    expect(result.stepId).toBe('decision-1')
  })

  test('validates bid from external trigger', () => {
    const result = DecisionStepSchema.parse({
      type: 'decision',
      bids: [
        {
          thread: { label: 'Symbol(external)', id: 'ingress-test' },
          source: 'trigger',
          selected: true,
          type: 'task',
          detail: { content: 'user message' },
          priority: 0,
        },
      ],
      timestamp: Date.now(),
    })
    expect(result.bids[0]!.source).toBe('trigger')
  })

  test('rejects missing bids field', () => {
    expect(() =>
      DecisionStepSchema.parse({
        type: 'decision',
        timestamp: Date.now(),
      }),
    ).toThrow()
  })
})

describe('ToolDefinitionSchema', () => {
  test('validates a complete tool definition', () => {
    const result = ToolDefinitionSchema.parse({
      type: 'function',
      function: {
        name: 'read_file',
        description: 'Read a file from the workspace',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path' },
          },
          required: ['path'],
        },
      },
    })
    expect(result.function.name).toBe('read_file')
  })

  test('accepts minimal definition without parameters', () => {
    const result = ToolDefinitionSchema.parse({
      type: 'function',
      function: { name: 'list_files' },
    })
    expect(result.function.parameters).toBeUndefined()
  })
})

describe('ModelUsageSchema', () => {
  test('validates token counts', () => {
    const result = ModelUsageSchema.parse({ inputTokens: 1500, outputTokens: 300 })
    expect(result.inputTokens).toBe(1500)
    expect(result.outputTokens).toBe(300)
  })
})

describe('RequestBashDetailSchema', () => {
  test('accepts a writable signal with schema metadata', () => {
    const signal = {
      get: () => undefined,
      listen: () => () => {},
      set: () => {},
      schema: { safeParse: () => ({ success: true, data: undefined }) },
    }

    const result = RequestBashDetailSchema.parse({
      input: {
        path: 'worker.ts',
        args: ['--help'],
      },
      signal,
    })

    expect(typeof result.signal.set).toBe('function')
    expect(typeof result.signal.listen).toBe('function')
  })

  test('rejects a signal without schema metadata', () => {
    expect(() =>
      RequestBashDetailSchema.parse({
        input: {
          path: 'worker.ts',
          args: [],
        },
        signal: {
          get: () => undefined,
          listen: () => () => {},
          set: () => {},
        },
      }),
    ).toThrow()
  })
})

describe('ModuleResultSchema', () => {
  test('accepts function-valued handlers', () => {
    const result = ModuleResultSchema.parse({
      handlers: {
        tool_completed: async () => {},
      },
    })

    expect(typeof result.handlers?.tool_completed).toBe('function')
  })

  test('rejects non-function handlers', () => {
    expect(() =>
      ModuleResultSchema.parse({
        handlers: {
          tool_completed: 'nope',
        },
      }),
    ).toThrow()
  })

  test('accepts branded behavioral rules in threads', () => {
    const thread = bSync({
      waitFor: {
        type: 'tick',
        sourceSchema: z.enum(['trigger', 'request', 'emit']),
        detailSchema: z.unknown(),
      },
    })

    const result = ModuleResultSchema.parse({
      threads: {
        onTick: thread,
      },
    })

    expect(result.threads?.onTick).toBe(thread)
  })
})

describe('UpdateModuleModuleSchema', () => {
  test('accepts module functions', () => {
    const module = () => ({})

    const result = UpdateModuleModuleSchema.parse({
      default: [module],
    })

    expect(result.default[0]).toBe(module)
  })

  test('rejects non-function modules', () => {
    expect(() =>
      UpdateModuleModuleSchema.parse({
        default: [{}],
      }),
    ).toThrow()
  })
})
