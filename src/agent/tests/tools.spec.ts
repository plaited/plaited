import { describe, expect, mock, test } from 'bun:test'
import type { ToolSchema } from '../agent.types.ts'
import { createToolRegistry } from '../tools.ts'

describe('createToolRegistry', () => {
  test('creates empty registry', () => {
    const registry = createToolRegistry()
    expect(registry.schemas).toEqual([])
  })

  test('registers tool with schema', () => {
    const registry = createToolRegistry()
    const schema: ToolSchema = {
      name: 'testTool',
      description: 'A test tool',
      parameters: {
        type: 'object',
        properties: {
          input: { type: 'string' },
        },
        required: ['input'],
      },
    }

    registry.register('testTool', async () => ({ success: true }), schema)

    expect(registry.schemas).toHaveLength(1)
    expect(registry.schemas[0]!.name).toBe('testTool')
  })

  test('prevents duplicate registration', () => {
    const registry = createToolRegistry()
    const schema: ToolSchema = {
      name: 'testTool',
      description: 'A test tool',
      parameters: { type: 'object', properties: {} },
    }

    const warnMock = mock(() => {})
    const originalWarn = console.warn
    console.warn = warnMock

    registry.register('testTool', async () => ({ success: true }), schema)
    registry.register('testTool', async () => ({ success: false }), schema)

    console.warn = originalWarn

    expect(registry.schemas).toHaveLength(1)
    expect(warnMock).toHaveBeenCalled()
  })

  test('executes registered tool', async () => {
    const registry = createToolRegistry()
    const handler = mock(async (args: Record<string, unknown>) => ({
      success: true,
      data: { received: args.input },
    }))

    registry.register('echoTool', handler, {
      name: 'echoTool',
      description: 'Echo input',
      parameters: { type: 'object', properties: { input: { type: 'string' } } },
    })

    const result = await registry.execute({
      name: 'echoTool',
      arguments: JSON.stringify({ input: 'hello' }),
    })

    expect(result.success).toBe(true)
    expect(result.data).toEqual({ received: 'hello' })
    expect(handler).toHaveBeenCalledWith({ input: 'hello' })
  })

  test('returns error for unknown tool', async () => {
    const registry = createToolRegistry()

    const result = await registry.execute({
      name: 'unknownTool',
      arguments: '{}',
    })

    expect(result.success).toBe(false)
    expect(result.error).toContain('Unknown tool')
  })

  test('handles invalid JSON arguments', async () => {
    const registry = createToolRegistry()
    registry.register('testTool', async () => ({ success: true }), {
      name: 'testTool',
      description: 'Test',
      parameters: { type: 'object', properties: {} },
    })

    const result = await registry.execute({
      name: 'testTool',
      arguments: 'not valid json',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  test('handles handler errors', async () => {
    const registry = createToolRegistry()
    registry.register(
      'failingTool',
      async () => {
        throw new Error('Tool failed')
      },
      { name: 'failingTool', description: 'Fails', parameters: { type: 'object', properties: {} } },
    )

    const result = await registry.execute({
      name: 'failingTool',
      arguments: '{}',
    })

    expect(result.success).toBe(false)
    expect(result.error).toBe('Tool failed')
  })

  test('returns copy of schemas array', () => {
    const registry = createToolRegistry()
    const schema: ToolSchema = {
      name: 'testTool',
      description: 'Test',
      parameters: { type: 'object', properties: {} },
    }

    registry.register('testTool', async () => ({ success: true }), schema)

    const schemas1 = registry.schemas
    const schemas2 = registry.schemas

    expect(schemas1).not.toBe(schemas2)
    expect(schemas1).toEqual(schemas2)
  })
})
