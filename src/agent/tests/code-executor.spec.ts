import { describe, expect, test } from 'bun:test'
import type { ToolRegistry, ToolResult } from '../agent.types.ts'
import {
  createCodeExecutor,
  executeWithTimeout,
  getUnsafePatterns,
  getWarningPatterns,
  hasUnsafePatterns,
  initializeSandbox,
  wrapToolRegistry,
} from '../code-executor.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const createMockToolRegistry = (): ToolRegistry => {
  const handlers = new Map<string, (args: Record<string, unknown>) => Promise<ToolResult>>()
  const schemas: ToolRegistry['schemas'] = [
    {
      name: 'testTool',
      description: 'A test tool',
      parameters: { type: 'object', properties: { input: { type: 'string' } } },
    },
  ]

  return {
    register(name, handler, schema) {
      handlers.set(name, handler)
      // Also add schema if not already present
      if (!schemas.find((s) => s.name === name)) {
        schemas.push(schema)
      }
    },
    async execute(call) {
      const handler = handlers.get(call.name)
      if (!handler) {
        return { success: false, error: `Unknown tool: ${call.name}` }
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

// ============================================================================
// Pattern Detection Tests
// ============================================================================

describe('hasUnsafePatterns', () => {
  test('detects process.env access', () => {
    expect(hasUnsafePatterns('const key = process.env.API_KEY')).toBe(true)
  })

  test('detects Bun.env access', () => {
    expect(hasUnsafePatterns('const key = Bun.env.SECRET')).toBe(true)
  })

  test('detects Deno.env access', () => {
    expect(hasUnsafePatterns('const key = Deno.env.get("KEY")')).toBe(true)
  })

  test('detects require child_process', () => {
    expect(hasUnsafePatterns('const { exec } = require("child_process")')).toBe(true)
  })

  test('detects import child_process', () => {
    expect(hasUnsafePatterns('import { exec } from "child_process"')).toBe(true)
  })

  test('detects Bun.spawn', () => {
    expect(hasUnsafePatterns('Bun.spawn(["ls", "-la"])')).toBe(true)
  })

  test('detects eval', () => {
    expect(hasUnsafePatterns('eval("alert(1)")')).toBe(true)
  })

  test('detects Function constructor', () => {
    expect(hasUnsafePatterns('new Function("return 1")')).toBe(true)
    expect(hasUnsafePatterns('Function("return 1")()')).toBe(true)
  })

  test('detects dynamic global access', () => {
    expect(hasUnsafePatterns('globalThis["eval"]')).toBe(true)
    expect(hasUnsafePatterns('window["eval"]')).toBe(true)
  })

  test('passes safe code', () => {
    expect(hasUnsafePatterns('const x = 1 + 2')).toBe(false)
    expect(hasUnsafePatterns('const fn = () => console.log("hi")')).toBe(false)
    expect(hasUnsafePatterns('await tools.writeTemplate({ path: "a.tsx" })')).toBe(false)
  })
})

describe('getUnsafePatterns', () => {
  test('returns all matched unsafe patterns', () => {
    const code = `
      const key = process.env.KEY
      eval("code")
    `
    const patterns = getUnsafePatterns(code)
    expect(patterns.length).toBe(2)
    expect(patterns.some((p) => p.includes('Environment'))).toBe(true)
    expect(patterns.some((p) => p.includes('eval'))).toBe(true)
  })

  test('returns empty array for safe code', () => {
    const patterns = getUnsafePatterns('const x = 1')
    expect(patterns.length).toBe(0)
  })
})

describe('getWarningPatterns', () => {
  test('detects fetch usage', () => {
    const warnings = getWarningPatterns('await fetch("https://api.example.com")')
    expect(warnings.some((w) => w.includes('Network'))).toBe(true)
  })

  test('detects XMLHttpRequest', () => {
    const warnings = getWarningPatterns('new XMLHttpRequest()')
    expect(warnings.some((w) => w.includes('XHR'))).toBe(true)
  })

  test('detects dynamic imports', () => {
    const warnings = getWarningPatterns('const mod = await import("./module")')
    expect(warnings.some((w) => w.includes('import'))).toBe(true)
  })
})

// ============================================================================
// Code Executor Tests
// ============================================================================

describe('createCodeExecutor', () => {
  test('creates executor with validate and execute methods', () => {
    const tools = createMockToolRegistry()
    const executor = createCodeExecutor({ tools })

    expect(typeof executor.validate).toBe('function')
    expect(typeof executor.execute).toBe('function')
  })

  test('validate returns valid for safe code', () => {
    const tools = createMockToolRegistry()
    const executor = createCodeExecutor({ tools })

    const result = executor.validate('const x = 1 + 2')
    expect(result.valid).toBe(true)
    expect(result.errors.length).toBe(0)
  })

  test('validate returns invalid for unsafe code', () => {
    const tools = createMockToolRegistry()
    const executor = createCodeExecutor({ tools })

    const result = executor.validate('eval("bad")')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })

  test('validate returns warnings for suspicious code', () => {
    const tools = createMockToolRegistry()
    const executor = createCodeExecutor({ tools })

    const result = executor.validate('await fetch("url")')
    expect(result.warnings.length).toBeGreaterThan(0)
  })

  test('execute rejects unsafe code', async () => {
    const tools = createMockToolRegistry()
    const executor = createCodeExecutor({ tools })

    const result = await executor.execute('eval("bad")')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Unsafe')
  })

  test('execute runs safe code successfully', async () => {
    const tools = createMockToolRegistry()
    const executor = createCodeExecutor({ tools })

    const result = await executor.execute('return 1 + 2')
    expect(result.success).toBe(true)
    expect(result.output).toBe(3)
  })

  test('execute captures errors', async () => {
    const tools = createMockToolRegistry()
    const executor = createCodeExecutor({ tools })

    const result = await executor.execute('throw new Error("test error")')
    expect(result.success).toBe(false)
    expect(result.error).toContain('test error')
  })

  test('execute includes duration', async () => {
    const tools = createMockToolRegistry()
    const executor = createCodeExecutor({ tools })

    const result = await executor.execute('return 42')
    expect(result.duration).toBeDefined()
    expect(typeof result.duration).toBe('number')
  })

  test('skipPatternValidation allows unsafe code through', async () => {
    const tools = createMockToolRegistry()
    const executor = createCodeExecutor({ tools, skipPatternValidation: true })

    const result = executor.validate('eval("code")')
    expect(result.valid).toBe(true)
  })

  test('additionalUnsafePatterns extends detection', () => {
    const tools = createMockToolRegistry()
    const executor = createCodeExecutor({
      tools,
      additionalUnsafePatterns: [{ pattern: /secretFunction/, message: 'Custom unsafe pattern' }],
    })

    const result = executor.validate('secretFunction()')
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('Custom'))).toBe(true)
  })
})

// ============================================================================
// Tool Execution Tracking Tests
// ============================================================================

describe('tool execution tracking', () => {
  test('execute tracks tool calls made during execution', async () => {
    const tools = createMockToolRegistry()
    tools.register('writeTemplate', async (args) => ({ success: true, data: { path: args.path } }), {
      name: 'writeTemplate',
      description: 'Write a template',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
    })

    const executor = createCodeExecutor({ tools })

    const code = `
      await tools.writeTemplate({ path: 'test.tsx' })
      return 'done'
    `

    const result = await executor.execute(code)

    expect(result.success).toBe(true)
    expect(result.toolCalls?.length).toBe(1)
    expect(result.toolCalls?.[0]?.name).toBe('writeTemplate')
  })
})

// ============================================================================
// Sandbox Initialization Tests
// ============================================================================

describe('initializeSandbox', () => {
  test('accepts valid configuration', async () => {
    await expect(
      initializeSandbox({
        allowWrite: ['/tmp'],
        denyRead: ['/etc'],
        allowedDomains: ['example.com'],
        timeout: 5000,
      }),
    ).resolves.toBeUndefined()
  })

  test('rejects negative timeout', async () => {
    await expect(
      initializeSandbox({
        timeout: -1000,
      }),
    ).rejects.toThrow('timeout')
  })

  test('rejects invalid path arrays', async () => {
    await expect(
      initializeSandbox({
        // @ts-expect-error Testing invalid input
        allowWrite: [123],
      }),
    ).rejects.toThrow('Invalid')
  })

  test('accepts empty configuration', async () => {
    await expect(initializeSandbox({})).resolves.toBeUndefined()
  })
})

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('wrapToolRegistry', () => {
  test('wraps registry to track calls', async () => {
    const tools = createMockToolRegistry()
    const calls: Array<{ name: string; args: unknown; result: ToolResult }> = []

    const wrapped = wrapToolRegistry(tools, (name, args, result) => {
      calls.push({ name, args, result })
    })

    await wrapped.execute({ name: 'testTool', arguments: '{"input":"test"}' })

    expect(calls.length).toBe(1)
    expect(calls[0]?.name).toBe('testTool')
  })

  test('preserves original registry properties', () => {
    const tools = createMockToolRegistry()
    const wrapped = wrapToolRegistry(tools, () => {})

    expect(wrapped.schemas).toEqual(tools.schemas)
  })
})

describe('executeWithTimeout', () => {
  test('returns result before timeout', async () => {
    const tools = createMockToolRegistry()
    const executor = createCodeExecutor({ tools })

    const result = await executeWithTimeout(executor, 'return 42', 5000)
    expect(result.success).toBe(true)
    expect(result.output).toBe(42)
  })

  test('returns timeout error when exceeded', async () => {
    const tools = createMockToolRegistry()
    const executor = createCodeExecutor({ tools })

    // Create an executor that takes longer than timeout
    const slowCode = `
      await new Promise(resolve => setTimeout(resolve, 500))
      return 42
    `

    const result = await executeWithTimeout(executor, slowCode, 100)
    expect(result.success).toBe(false)
    expect(result.error).toContain('timed out')
  })
})
