import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import type { FunctionCall, ToolRegistry, ToolSchema } from '../agent.types.ts'
import { useWorldAgent } from '../use-world-agent.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const TEST_SKILLS_DIR = '/tmp/claude/test-world-agent-skills'

const createMockToolRegistry = (): ToolRegistry => {
  const handlers = new Map()
  const schemasList: ToolSchema[] = []

  return {
    register(name, handler, schema) {
      handlers.set(name, handler)
      schemasList.push(schema)
    },
    async execute(call: FunctionCall) {
      const handler = handlers.get(call.name)
      if (!handler) {
        return { success: false, error: `Unknown tool: ${call.name}` }
      }
      const args = JSON.parse(call.arguments)
      return handler(args)
    },
    get schemas() {
      return schemasList
    },
  }
}

const createMockModel = (toolCalls: FunctionCall[] = []) => ({
  chatCompletion: async () => ({
    tool_calls: toolCalls,
  }),
})

beforeAll(async () => {
  await rm(TEST_SKILLS_DIR, { recursive: true, force: true })
  await mkdir(TEST_SKILLS_DIR, { recursive: true })

  // Create a test skill
  const skillDir = join(TEST_SKILLS_DIR, 'test-skill')
  await mkdir(skillDir, { recursive: true })
  await mkdir(join(skillDir, 'scripts'), { recursive: true })

  // Create SKILL.md
  await Bun.write(
    join(skillDir, 'SKILL.md'),
    `---
name: test-skill
description: A test skill for world agent tests
---

# Test Skill
`,
  )

  // Create a script
  await Bun.write(
    join(skillDir, 'scripts', 'hello.ts'),
    `/**
 * Hello world script.
 */
console.log(JSON.stringify({ message: 'hello' }))
`,
  )
})

afterAll(async () => {
  await rm(TEST_SKILLS_DIR, { recursive: true, force: true })
})

// ============================================================================
// Basic Agent Tests
// ============================================================================

describe('useWorldAgent', () => {
  test('creates agent without skill discovery', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()

    const trigger = await useWorldAgent({ tools, model })

    expect(trigger).toBeDefined()
    expect(typeof trigger).toBe('function')
  })

  test('triggers generate event', async () => {
    const tools = createMockToolRegistry()
    const toolCalls: FunctionCall[] = [{ name: 'writeTemplate', arguments: '{"path":"test.tsx"}' }]
    const model = createMockModel(toolCalls)

    // Register the tool that will be called
    tools.register('writeTemplate', async () => ({ success: true, data: { path: 'test.tsx' } }), {
      name: 'writeTemplate',
      description: 'Write template',
      parameters: { type: 'object', properties: {} },
    })

    const trigger = await useWorldAgent({ tools, model })

    // Should not throw
    trigger({ type: 'generate', detail: { intent: 'Create a button' } })
  })
})

// ============================================================================
// Skill Integration Tests
// ============================================================================

describe('useWorldAgent with skills', () => {
  test('discovers and registers skill scripts', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()

    const logs: string[] = []
    const logger = {
      info: (msg: string) => logs.push(msg),
      warn: () => {},
      error: () => {},
    }

    await useWorldAgent({
      tools,
      model,
      logger,
      skills: { skillsRoot: TEST_SKILLS_DIR },
    })

    // Should have logged skill discovery
    expect(logs.some((l) => l.includes('skill scripts'))).toBe(true)

    // Should have registered the script as a tool
    expect(tools.schemas.some((s) => s.name === 'test-skill:hello')).toBe(true)
  })

  test('includes skill context in system prompt', async () => {
    const tools = createMockToolRegistry()
    let capturedMessages: unknown[] = []

    const model = {
      chatCompletion: async (args: { messages: unknown[] }) => {
        capturedMessages = args.messages
        return { tool_calls: [] }
      },
    }

    const trigger = await useWorldAgent({
      tools,
      model,
      skills: { skillsRoot: TEST_SKILLS_DIR },
    })

    trigger({ type: 'generate', detail: { intent: 'Test intent' } })

    // Wait for async handler
    await new Promise((resolve) => setTimeout(resolve, 50))

    // System prompt should include skill context
    const systemMessage = capturedMessages[0] as { role: string; content: string }
    expect(systemMessage.role).toBe('system')
    expect(systemMessage.content).toContain('available_skills')
  })

  test('uses custom system prompt with skill context', async () => {
    const tools = createMockToolRegistry()
    let capturedMessages: unknown[] = []

    const model = {
      chatCompletion: async (args: { messages: unknown[] }) => {
        capturedMessages = args.messages
        return { tool_calls: [] }
      },
    }

    const trigger = await useWorldAgent({
      tools,
      model,
      skills: { skillsRoot: TEST_SKILLS_DIR },
      systemPrompt: 'You are a custom agent.',
    })

    trigger({ type: 'generate', detail: { intent: 'Test intent' } })

    await new Promise((resolve) => setTimeout(resolve, 50))

    const systemMessage = capturedMessages[0] as { role: string; content: string }
    expect(systemMessage.content).toContain('You are a custom agent.')
    expect(systemMessage.content).toContain('available_skills')
  })
})

// ============================================================================
// Event Handler Tests
// ============================================================================

describe('useWorldAgent event handlers', () => {
  test('handles storyResult event', async () => {
    const tools = createMockToolRegistry()
    const model = createMockModel()

    const warnings: string[] = []
    const logger = {
      info: () => {},
      warn: (msg: string) => warnings.push(msg),
      error: () => {},
    }

    const trigger = await useWorldAgent({ tools, model, logger })

    trigger({
      type: 'storyResult',
      detail: {
        passed: false,
        totalAssertions: 2,
        passedAssertions: 1,
        a11yPassed: false,
        errors: ['Test failed'],
      },
    })

    await new Promise((resolve) => setTimeout(resolve, 50))

    expect(warnings.some((w) => w.includes('Story failed'))).toBe(true)
    expect(warnings.some((w) => w.includes('Accessibility'))).toBe(true)
  })
})
