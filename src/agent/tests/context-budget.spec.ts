import { describe, expect, test } from 'bun:test'
import type { ToolSchema } from '../agent.types.ts'
import {
  createContextBudget,
  estimateConversationTokens,
  estimateTokens,
  estimateToolsTokens,
  estimateToolTokens,
  filterToolsByBudget,
  prioritizeTools,
  trimConversation,
} from '../context-budget.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const createTestTool = (name: string, descLength = 50, paramCount = 2): ToolSchema => {
  const properties: Record<string, { type: string; description: string }> = {}
  const required: string[] = []

  for (let i = 0; i < paramCount; i++) {
    properties[`param${i}`] = {
      type: 'string',
      description: `Parameter ${i} description`,
    }
    required.push(`param${i}`)
  }

  return {
    name,
    description: 'x'.repeat(descLength),
    parameters: {
      type: 'object',
      properties,
      required,
    },
  }
}

// ============================================================================
// Token Estimation Tests
// ============================================================================

describe('estimateTokens', () => {
  test('estimates tokens from character count', () => {
    const text = 'Hello world' // 11 chars
    const tokens = estimateTokens(text)

    // Default 4 chars per token: ceil(11/4) = 3
    expect(tokens).toBe(3)
  })

  test('handles empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  test('respects custom chars per token', () => {
    const text = 'Hello world' // 11 chars
    const tokens = estimateTokens(text, 3)

    // ceil(11/3) = 4
    expect(tokens).toBe(4)
  })

  test('handles long text', () => {
    const text = 'x'.repeat(10000)
    const tokens = estimateTokens(text)

    expect(tokens).toBe(2500) // 10000/4
  })
})

describe('estimateToolTokens', () => {
  test('estimates tokens for tool schema', () => {
    const tool = createTestTool('testTool', 100, 3)
    const tokens = estimateToolTokens(tool)

    expect(tokens).toBeGreaterThan(0)
  })

  test('larger tools use more tokens', () => {
    const smallTool = createTestTool('small', 50, 1)
    const largeTool = createTestTool('large', 200, 5)

    const smallTokens = estimateToolTokens(smallTool)
    const largeTokens = estimateToolTokens(largeTool)

    expect(largeTokens).toBeGreaterThan(smallTokens)
  })
})

describe('estimateToolsTokens', () => {
  test('sums tokens for multiple tools', () => {
    const tools = [createTestTool('tool1', 50, 1), createTestTool('tool2', 100, 2), createTestTool('tool3', 150, 3)]

    const total = estimateToolsTokens(tools)

    const individual = tools.reduce((sum, t) => sum + estimateToolTokens(t), 0)
    expect(total).toBe(individual)
  })

  test('returns 0 for empty array', () => {
    expect(estimateToolsTokens([])).toBe(0)
  })
})

// ============================================================================
// Context Budget Tests
// ============================================================================

describe('createContextBudget', () => {
  test('creates budget with default config', () => {
    const budget = createContextBudget()
    const status = budget.status()

    expect(status.total).toBe(32000)
    expect(status.used).toBe(0)
    expect(status.available).toBe(32000)
  })

  test('respects custom total budget', () => {
    const budget = createContextBudget({ totalBudget: 128000 })
    const status = budget.status()

    expect(status.total).toBe(128000)
  })

  test('allocates tokens to sections', () => {
    const budget = createContextBudget()

    budget.allocate('tools', 10000)

    const status = budget.status()
    const toolsSection = status.sections.find((s) => s.section === 'tools')
    expect(toolsSection?.allocated).toBe(10000)
  })

  test('tracks usage per section', () => {
    const budget = createContextBudget()

    budget.use('system', 1000)
    budget.use('tools', 2000)

    const status = budget.status()
    expect(status.used).toBe(3000)

    const systemSection = status.sections.find((s) => s.section === 'system')
    expect(systemSection?.used).toBe(1000)
  })

  test('calculates available tokens', () => {
    const budget = createContextBudget({ totalBudget: 10000 })

    budget.use('system', 2000)
    budget.use('tools', 3000)

    expect(budget.status().available).toBe(5000)
  })

  test('detects exceeded budget', () => {
    const budget = createContextBudget({ totalBudget: 1000 })

    budget.use('system', 600)
    budget.use('tools', 600)

    expect(budget.status().exceeded).toBe(true)
  })
})

describe('canFit', () => {
  test('returns true when tokens fit', () => {
    const budget = createContextBudget({ totalBudget: 10000 })

    expect(budget.canFit(5000)).toBe(true)
  })

  test('returns false when tokens exceed budget', () => {
    const budget = createContextBudget({ totalBudget: 1000 })

    budget.use('system', 800)

    expect(budget.canFit(500)).toBe(false)
  })

  test('checks section-specific allocation', () => {
    const budget = createContextBudget()

    budget.allocate('tools', 100)

    expect(budget.canFit(50, 'tools')).toBe(true)
    expect(budget.canFit(150, 'tools')).toBe(false)
  })
})

describe('fitToBudget', () => {
  test('keeps items that fit', () => {
    const budget = createContextBudget({ totalBudget: 100 })

    const items = [
      { content: 'item1', tokens: 30, priority: 1, section: 'tools' as const },
      { content: 'item2', tokens: 30, priority: 2, section: 'tools' as const },
      { content: 'item3', tokens: 30, priority: 3, section: 'tools' as const },
    ]

    const result = budget.fitToBudget(items)

    expect(result).toHaveLength(3)
  })

  test('excludes items that exceed budget', () => {
    const budget = createContextBudget({ totalBudget: 50 })

    const items = [
      { content: 'item1', tokens: 30, priority: 1, section: 'tools' as const },
      { content: 'item2', tokens: 30, priority: 2, section: 'tools' as const },
    ]

    const result = budget.fitToBudget(items)

    // Only one item fits (50 budget, each item is 30)
    expect(result).toHaveLength(1)
  })

  test('prioritizes higher priority items', () => {
    const budget = createContextBudget({ totalBudget: 50 })

    const items = [
      { content: 'low', tokens: 30, priority: 1, section: 'tools' as const },
      { content: 'high', tokens: 30, priority: 10, section: 'tools' as const },
    ]

    const result = budget.fitToBudget(items)

    expect(result).toEqual(['high'])
  })
})

describe('reset', () => {
  test('resets usage but keeps allocations', () => {
    const budget = createContextBudget()

    budget.allocate('tools', 5000)
    budget.use('tools', 2000)

    budget.reset()

    const status = budget.status()
    const toolsSection = status.sections.find((s) => s.section === 'tools')

    expect(toolsSection?.used).toBe(0)
    expect(toolsSection?.allocated).toBe(5000)
  })
})

describe('setPriority', () => {
  test('updates section priority', () => {
    const budget = createContextBudget()

    budget.setPriority('cache', 100)

    const status = budget.status()
    const cacheSection = status.sections.find((s) => s.section === 'cache')

    expect(cacheSection?.priority).toBe(100)
  })
})

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('prioritizeTools', () => {
  test('creates prioritized content from schemas', () => {
    const tools = [createTestTool('tool1'), createTestTool('tool2')]

    const prioritized = prioritizeTools(tools)

    expect(prioritized).toHaveLength(2)
    expect(prioritized[0]!.section).toBe('tools')
    expect(prioritized[0]!.tokens).toBeGreaterThan(0)
  })

  test('earlier tools get higher priority', () => {
    const tools = [createTestTool('first'), createTestTool('second'), createTestTool('third')]

    const prioritized = prioritizeTools(tools)

    expect(prioritized[0]!.priority).toBeGreaterThan(prioritized[1]!.priority)
    expect(prioritized[1]!.priority).toBeGreaterThan(prioritized[2]!.priority)
  })
})

describe('filterToolsByBudget', () => {
  test('keeps tools that fit budget', () => {
    const tools = [createTestTool('tool1', 20, 1), createTestTool('tool2', 20, 1), createTestTool('tool3', 20, 1)]

    // Calculate what budget would fit 2 tools
    const twoToolTokens = estimateToolsTokens(tools.slice(0, 2))

    const result = filterToolsByBudget(tools, twoToolTokens)

    expect(result.length).toBeLessThanOrEqual(2)
  })

  test('returns empty array when budget is 0', () => {
    const tools = [createTestTool('tool1')]

    const result = filterToolsByBudget(tools, 0)

    expect(result).toHaveLength(0)
  })
})

describe('estimateConversationTokens', () => {
  test('estimates tokens for messages', () => {
    const messages = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there!' },
    ]

    const tokens = estimateConversationTokens(messages)

    // Should include role overhead + content
    expect(tokens).toBeGreaterThan(0)
  })

  test('includes role overhead per message', () => {
    const singleMessage = [{ role: 'user', content: 'Hi' }]
    const doubleMessage = [
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hi' },
    ]

    const single = estimateConversationTokens(singleMessage)
    const double = estimateConversationTokens(doubleMessage)

    // Double should be more than 2x single due to overhead
    expect(double).toBeGreaterThan(single)
  })
})

describe('trimConversation', () => {
  test('keeps recent messages within budget', () => {
    const messages = [
      { role: 'user', content: 'Message 1' },
      { role: 'assistant', content: 'Response 1' },
      { role: 'user', content: 'Message 2' },
      { role: 'assistant', content: 'Response 2' },
    ]

    // Small budget - should only keep recent messages
    const trimmed = trimConversation(messages, 20)

    expect(trimmed.length).toBeLessThan(messages.length)
  })

  test('preserves system messages', () => {
    const messages = [
      { role: 'system', content: 'You are a helpful assistant' },
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi!' },
    ]

    const trimmed = trimConversation(messages, 50)

    const systemMessages = trimmed.filter((m) => m.role === 'system')
    expect(systemMessages.length).toBeGreaterThan(0)
  })

  test('keeps most recent non-system messages', () => {
    const messages = [
      { role: 'user', content: 'Old message' },
      { role: 'assistant', content: 'Old response' },
      { role: 'user', content: 'Recent message' },
      { role: 'assistant', content: 'Recent response' },
    ]

    // Very tight budget
    const trimmed = trimConversation(messages, 30)

    // Should have the most recent messages
    const hasRecent = trimmed.some((m) => m.content.includes('Recent'))
    expect(hasRecent).toBe(true)
  })
})

// ============================================================================
// Integration Tests
// ============================================================================

describe('integration', () => {
  test('full workflow: estimate, allocate, use, check', () => {
    const budget = createContextBudget({ totalBudget: 10000 })

    // Estimate system prompt
    const systemPrompt = 'You are a helpful assistant that generates UI templates.'
    const systemTokens = budget.estimateTokens(systemPrompt)
    budget.use('system', systemTokens)

    // Estimate and add tools
    const tools = [createTestTool('writeTemplate', 100, 2), createTestTool('runStory', 80, 1)]

    for (const tool of tools) {
      const tokens = budget.estimateToolTokens(tool)
      if (budget.canFit(tokens, 'tools')) {
        budget.use('tools', tokens)
      }
    }

    const status = budget.status()

    expect(status.used).toBeGreaterThan(0)
    expect(status.available).toBeLessThan(10000)
    expect(status.exceeded).toBe(false)
  })

  test('progressive tool disclosure with budget', () => {
    const budget = createContextBudget({ totalBudget: 500 })

    // Many tools but limited budget
    const allTools = Array.from({ length: 20 }, (_, i) => createTestTool(`tool${i}`, 50, 2))

    // Filter to fit budget
    const toolsBudget = 300
    const filteredTools = filterToolsByBudget(allTools, toolsBudget)

    // Record actual usage
    for (const tool of filteredTools) {
      budget.use('tools', budget.estimateToolTokens(tool))
    }

    expect(filteredTools.length).toBeLessThan(allTools.length)
    expect(budget.status().sections.find((s) => s.section === 'tools')?.used).toBeLessThanOrEqual(toolsBudget)
  })
})
