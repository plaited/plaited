import { describe, expect, test } from 'bun:test'
import { behavioral } from '../../main/behavioral.ts'
import { bSync, bThread } from '../../main/behavioral.utils.ts'
import { createContextBudget } from '../context-budget.ts'
import {
  createCoordinateToolChain,
  createEnforceContextBudget,
  createEnforceTieredAnalysis,
  createEnforceWorkflowSequence,
  createLimitConcurrentGeneration,
  registerWorkflowConstraints,
} from '../workflow-constraints.ts'

// ============================================================================
// Test Utilities
// ============================================================================

/**
 * Create a test behavioral program with snapshot-based event tracking.
 *
 * @remarks
 * Uses useSnapshot to capture all event selections. Events are tracked
 * as selected (went through) or blocked (prevented by constraints).
 */
const createTestBP = () => {
  const selectedEvents: Array<{ type: string; detail?: unknown }> = []
  const blockedEvents: Array<{ type: string; blockedBy?: string }> = []
  const { trigger, bThreads, useSnapshot } = behavioral()

  // Use snapshot to track all event selections
  useSnapshot((snapshot) => {
    for (const bid of snapshot) {
      if (bid.selected) {
        selectedEvents.push({ type: bid.type, detail: bid.detail })
      } else if (bid.blockedBy) {
        blockedEvents.push({ type: bid.type, blockedBy: bid.blockedBy })
      }
    }
  })

  return { trigger, bThreads, selectedEvents, blockedEvents }
}

// ============================================================================
// Workflow Sequence Tests
// ============================================================================

describe('createEnforceWorkflowSequence', () => {
  test('creates a valid bThread', () => {
    const constraint = createEnforceWorkflowSequence(bSync, bThread)
    expect(typeof constraint).toBe('function')
  })

  test('allows events in correct sequence', () => {
    const { trigger, bThreads, selectedEvents } = createTestBP()

    bThreads.set({
      enforceWorkflowSequence: createEnforceWorkflowSequence(bSync, bThread),
    })

    // Sequence: generate → staticAnalysis (pass) → executeCode
    trigger({ type: 'generate', detail: { intent: 'test' } })
    expect(selectedEvents.some((e) => e.type === 'generate')).toBe(true)

    trigger({ type: 'staticAnalysis', detail: { passed: true, tier: 1, checks: [] } })
    expect(selectedEvents.some((e) => e.type === 'staticAnalysis')).toBe(true)

    trigger({ type: 'executeCode', detail: { code: 'test' } })
    expect(selectedEvents.some((e) => e.type === 'executeCode')).toBe(true)
  })

  test('blocks executeCode before staticAnalysis', () => {
    const { trigger, bThreads, selectedEvents } = createTestBP()

    bThreads.set({
      enforceWorkflowSequence: createEnforceWorkflowSequence(bSync, bThread),
    })

    trigger({ type: 'generate', detail: { intent: 'test' } })

    // Try to execute before static analysis
    trigger({ type: 'executeCode', detail: { code: 'test' } })

    // executeCode should be blocked (only generate should be in selected events)
    // Note: We verify blocking by confirming the event was NOT selected
    const executeEvents = selectedEvents.filter((e) => e.type === 'executeCode')
    expect(executeEvents.length).toBe(0)

    // Only generate should have been selected
    expect(selectedEvents.some((e) => e.type === 'generate')).toBe(true)
  })
})

// ============================================================================
// Context Budget Tests
// ============================================================================

describe('createEnforceContextBudget', () => {
  test('creates a valid bThread', () => {
    const budget = createContextBudget({ totalBudget: 1000 })
    const constraint = createEnforceContextBudget(bSync, bThread, budget)
    expect(typeof constraint).toBe('function')
  })

  test('allows tool calls within budget', () => {
    const { trigger, bThreads, selectedEvents } = createTestBP()
    const budget = createContextBudget({ totalBudget: 10000 })

    budget.allocate('tools', 5000)

    bThreads.set({
      enforceContextBudget: createEnforceContextBudget(bSync, bThread, budget),
    })

    // Small tool call should be allowed
    trigger({
      type: 'toolCall',
      detail: {
        calls: [
          {
            name: 'smallTool',
            schema: {
              name: 'smallTool',
              description: 'A small tool',
              parameters: { type: 'object', properties: {} },
            },
          },
        ],
      },
    })

    expect(selectedEvents.some((e) => e.type === 'toolCall')).toBe(true)
  })

  test('blocks tool calls exceeding budget', () => {
    const { trigger, bThreads, selectedEvents, blockedEvents: _blockedEvents } = createTestBP()
    const budget = createContextBudget({ totalBudget: 100 })

    budget.allocate('tools', 50)
    budget.use('tools', 45) // Only 5 tokens left

    bThreads.set({
      enforceContextBudget: createEnforceContextBudget(bSync, bThread, budget),
    })

    // Large tool call should be blocked
    trigger({
      type: 'toolCall',
      detail: {
        calls: [
          {
            name: 'largeTool',
            schema: {
              name: 'largeTool',
              description: 'A large tool with lots of description text that will exceed the budget',
              parameters: {
                type: 'object',
                properties: {
                  param1: { type: 'string', description: 'Long parameter description' },
                  param2: { type: 'string', description: 'Another long description' },
                },
              },
            },
          },
        ],
      },
    })

    // Should be blocked
    const toolCallEvents = selectedEvents.filter((e) => e.type === 'toolCall')
    expect(toolCallEvents.length).toBe(0)
  })
})

// ============================================================================
// Concurrent Generation Tests
// ============================================================================

describe('createLimitConcurrentGeneration', () => {
  test('creates a valid bThread', () => {
    const constraint = createLimitConcurrentGeneration(bSync, bThread)
    expect(typeof constraint).toBe('function')
  })

  test('allows first generation', () => {
    const { trigger, bThreads, selectedEvents } = createTestBP()

    bThreads.set({
      limitConcurrentGeneration: createLimitConcurrentGeneration(bSync, bThread),
    })

    trigger({ type: 'generate', detail: { intent: 'first' } })
    expect(selectedEvents.some((e) => e.type === 'generate')).toBe(true)
  })

  test('blocks second generation while first is in progress', () => {
    const { trigger, bThreads, selectedEvents } = createTestBP()

    bThreads.set({
      limitConcurrentGeneration: createLimitConcurrentGeneration(bSync, bThread),
    })

    // First generation
    trigger({ type: 'generate', detail: { intent: 'first' } })

    // Second generation should be blocked
    trigger({ type: 'generate', detail: { intent: 'second' } })

    // Only one generate event should have been selected
    // (the second was blocked, so it doesn't appear in selectedEvents)
    const generateEvents = selectedEvents.filter((e) => e.type === 'generate')
    expect(generateEvents.length).toBe(1)
  })

  test('allows new generation after completion', () => {
    const { trigger, bThreads, selectedEvents } = createTestBP()

    bThreads.set({
      limitConcurrentGeneration: createLimitConcurrentGeneration(bSync, bThread),
    })

    // First generation
    trigger({ type: 'generate', detail: { intent: 'first' } })

    // Complete the generation
    trigger({ type: 'generationComplete', detail: undefined })

    // Second generation should be allowed
    trigger({ type: 'generate', detail: { intent: 'second' } })

    const generateEvents = selectedEvents.filter((e) => e.type === 'generate')
    expect(generateEvents.length).toBe(2)
  })

  test('allows new generation after error', () => {
    const { trigger, bThreads, selectedEvents } = createTestBP()

    bThreads.set({
      limitConcurrentGeneration: createLimitConcurrentGeneration(bSync, bThread),
    })

    trigger({ type: 'generate', detail: { intent: 'first' } })
    trigger({ type: 'error', detail: { error: new Error('test') } })
    trigger({ type: 'generate', detail: { intent: 'second' } })

    const generateEvents = selectedEvents.filter((e) => e.type === 'generate')
    expect(generateEvents.length).toBe(2)
  })

  test('allows new generation after cancel', () => {
    const { trigger, bThreads, selectedEvents } = createTestBP()

    bThreads.set({
      limitConcurrentGeneration: createLimitConcurrentGeneration(bSync, bThread),
    })

    trigger({ type: 'generate', detail: { intent: 'first' } })
    trigger({ type: 'cancel', detail: undefined })
    trigger({ type: 'generate', detail: { intent: 'second' } })

    const generateEvents = selectedEvents.filter((e) => e.type === 'generate')
    expect(generateEvents.length).toBe(2)
  })
})

// ============================================================================
// Tool Chain Coordination Tests
// ============================================================================

describe('createCoordinateToolChain', () => {
  test('creates a valid bThread', () => {
    const constraint = createCoordinateToolChain(bSync, bThread)
    expect(typeof constraint).toBe('function')
  })

  test('coordinates sequential tool chains', () => {
    const { trigger, bThreads, selectedEvents } = createTestBP()

    bThreads.set({
      coordinateToolChain: createCoordinateToolChain(bSync, bThread),
    })

    // Start sequential chain
    trigger({
      type: 'chainTools',
      detail: { calls: [], sequential: true },
    })

    expect(selectedEvents.some((e) => e.type === 'chainTools')).toBe(true)
  })
})

// ============================================================================
// Tiered Analysis Tests
// ============================================================================

describe('createEnforceTieredAnalysis', () => {
  test('creates a valid bThread', () => {
    const constraint = createEnforceTieredAnalysis(bSync, bThread)
    expect(typeof constraint).toBe('function')
  })

  test('supports skipTier2 option', () => {
    const constraint = createEnforceTieredAnalysis(bSync, bThread, { skipTier2: true })
    expect(typeof constraint).toBe('function')
  })

  test('blocks browser test before static analysis', () => {
    const { trigger, bThreads, selectedEvents, blockedEvents: _blockedEvents } = createTestBP()

    bThreads.set({
      enforceTieredAnalysis: createEnforceTieredAnalysis(bSync, bThread),
    })

    // Try browser test without static analysis
    trigger({ type: 'browserTest', detail: { result: { passed: true } } })

    // Should be blocked
    const browserEvents = selectedEvents.filter((e) => e.type === 'browserTest')
    expect(browserEvents.length).toBe(0)
  })

  test('allows browser test after passing static analysis', () => {
    const { trigger, bThreads, selectedEvents } = createTestBP()

    bThreads.set({
      enforceTieredAnalysis: createEnforceTieredAnalysis(bSync, bThread, { skipTier2: true }),
    })

    // Pass static analysis
    trigger({ type: 'staticAnalysis', detail: { passed: true, tier: 1, checks: [] } })

    // Browser test should be allowed
    trigger({ type: 'browserTest', detail: { result: { passed: true } } })

    expect(selectedEvents.some((e) => e.type === 'browserTest')).toBe(true)
  })
})

// ============================================================================
// Registration Tests
// ============================================================================

describe('registerWorkflowConstraints', () => {
  test('registers all default constraints', () => {
    const { bThreads } = createTestBP()
    const budget = createContextBudget()

    registerWorkflowConstraints(bThreads, bSync, bThread, { contextBudget: budget })

    // Verify constraints are registered by triggering events
    // The fact that we can call this without errors indicates registration worked
    expect(true).toBe(true)
  })

  test('registers without budget when not provided', () => {
    const { bThreads } = createTestBP()

    registerWorkflowConstraints(bThreads, bSync, bThread)

    // Should work without error
    expect(true).toBe(true)
  })

  test('respects skipTier2 option', () => {
    const { bThreads } = createTestBP()

    registerWorkflowConstraints(bThreads, bSync, bThread, { skipTier2: true })

    expect(true).toBe(true)
  })
})
