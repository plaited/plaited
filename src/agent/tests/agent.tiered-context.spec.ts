/**
 * Tests for tiered context management (Variant D) — hot/warm/cold layers.
 *
 * @remarks
 * Covers:
 * - Session summary contributor (warm layer)
 * - Progressive history trimming (three stages)
 * - Structured system prompt builder
 * - Integration: context assembly with all three tiers
 */

import { describe, expect, test } from 'bun:test'
import type { ChatMessage, ContextState, SessionMeta, ToolDefinition } from 'plaited'
import {
  createContextAssembler,
  createSessionSummaryContributor,
  createSystemPromptContributor,
  historyContributor,
  planContributor,
  rejectionContributor,
  systemPromptContributor,
  toolsContributor,
  trimHistory,
} from 'plaited'

// ============================================================================
// Test helpers
// ============================================================================

const mkMsg = (role: ChatMessage['role'], content: string, toolCallId?: string): ChatMessage => ({
  role,
  content,
  ...(toolCallId ? { tool_call_id: toolCallId } : {}),
})

const mkMeta = (overrides?: Partial<SessionMeta>): SessionMeta => ({
  '@id': 'test-session',
  '@type': 'Session',
  summary: '5 decisions; threads: taskGate, batchCompletion; events: task, tool_result; tools: read_file',
  threadTypes: ['taskGate', 'batchCompletion'],
  outcomeEvents: ['task', 'tool_result', 'message'],
  toolsUsed: ['read_file', 'edit_file'],
  decisionCount: 5,
  timestamp: '2026-03-15T00:00:00.000Z',
  ...overrides,
})

// ============================================================================
// createSessionSummaryContributor (warm layer)
// ============================================================================

describe('createSessionSummaryContributor', () => {
  test('returns null when no meta exists', () => {
    const contributor = createSessionSummaryContributor(null)
    const segment = contributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment).toBeNull()
  })

  test('returns system segment with formatted session summary', () => {
    const meta = mkMeta()
    const contributor = createSessionSummaryContributor(meta)
    const segment = contributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment).not.toBeNull()
    expect(segment!.role).toBe('system')
    expect(segment!.content).toContain('Session context (5 decisions)')
    expect(segment!.content).toContain('Threads active: taskGate, batchCompletion')
    expect(segment!.content).toContain('Events observed: task, tool_result, message')
    expect(segment!.content).toContain('Tools used: read_file, edit_file')
  })

  test('includes commit count when commits exist', () => {
    const meta = mkMeta({ commits: ['abc123', 'def456'] })
    const contributor = createSessionSummaryContributor(meta)
    const segment = contributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment!.content).toContain('Commits: 2')
  })

  test('omits empty sections', () => {
    const meta = mkMeta({ threadTypes: [], toolsUsed: [], commits: undefined })
    const contributor = createSessionSummaryContributor(meta)
    const segment = contributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment!.content).not.toContain('Threads active')
    expect(segment!.content).not.toContain('Tools used')
    expect(segment!.content).not.toContain('Commits')
  })

  test('has priority 70', () => {
    const contributor = createSessionSummaryContributor(null)
    expect(contributor.priority).toBe(70)
  })

  test('has name session_summary', () => {
    const contributor = createSessionSummaryContributor(null)
    expect(contributor.name).toBe('session_summary')
  })

  test('updateMeta refreshes the cached meta', () => {
    const contributor = createSessionSummaryContributor(null)

    // Initially null
    expect(contributor.contribute({ history: [], activeTools: [], constitution: [], priorRejections: [] })).toBeNull()

    // Update with real meta
    contributor.updateMeta(mkMeta({ decisionCount: 12 }))
    const segment = contributor.contribute({ history: [], activeTools: [], constitution: [], priorRejections: [] })
    expect(segment).not.toBeNull()
    expect(segment!.content).toContain('Session context (12 decisions)')
  })

  test('updateMeta replaces previous meta', () => {
    const contributor = createSessionSummaryContributor(mkMeta({ decisionCount: 3 }))
    contributor.updateMeta(mkMeta({ decisionCount: 42 }))
    const segment = contributor.contribute({ history: [], activeTools: [], constitution: [], priorRejections: [] })
    expect(segment!.content).toContain('Session context (42 decisions)')
  })
})

// ============================================================================
// Progressive trimHistory
// ============================================================================

describe('trimHistory (progressive)', () => {
  test('returns empty array for zero budget', () => {
    expect(trimHistory([mkMsg('user', 'hello')], 0)).toEqual([])
  })

  test('returns all messages when within budget (fast path)', () => {
    const history = [mkMsg('user', 'hi'), mkMsg('assistant', 'hello')]
    const result = trimHistory(history, 10000)
    expect(result).toEqual(history)
  })

  test('drops oldest messages first when over budget', () => {
    // Each message ~10 tokens (40 chars)
    const history = [
      mkMsg('user', 'a'.repeat(40)),
      mkMsg('tool', 'b'.repeat(40), 'tc-1'),
      mkMsg('user', 'c'.repeat(40)),
    ]
    // Budget for 2 messages (~20 tokens). recentWindow=10 (default) — all are "recent"
    // so no truncation happens, just drop oldest
    const result = trimHistory(history, 20)
    expect(result).toHaveLength(2)
    expect(result[0]!.content).toBe('b'.repeat(40))
    expect(result[1]!.content).toBe('c'.repeat(40))
  })

  test('truncates old tool results outside recent window to save space', () => {
    const bigToolContent = 'x'.repeat(400) // ~100 tokens
    const history = [
      mkMsg('tool', bigToolContent, 'tc-old'), // index 0 — outside recentWindow of 2
      mkMsg('user', 'a'.repeat(20)), // index 1 — outside recentWindow of 2
      mkMsg('assistant', 'b'.repeat(20)), // index 2 — inside recentWindow
      mkMsg('user', 'c'.repeat(20)), // index 3 — inside recentWindow
    ]
    // recentWindow=2 → tool at index 0 gets truncated to '[truncated]' (~3 tokens)
    // After truncation: [truncated](3) + a(5) + b(5) + c(5) = 18 tokens
    // Budget 20 → all fit after truncation
    const result = trimHistory(history, 20, 2)
    expect(result).toHaveLength(4) // all messages preserved
    // The old tool result should be truncated
    const truncatedTool = result.find((m) => m.role === 'tool' && m.content === '[truncated]')
    expect(truncatedTool).toBeDefined()
    // Recent messages keep their content
    expect(result[2]!.content).toBe('b'.repeat(20))
    expect(result[3]!.content).toBe('c'.repeat(20))
  })

  test('truncation preserves more messages than pure dropping would', () => {
    const bigToolContent = 'x'.repeat(400) // ~100 tokens
    const history = [
      mkMsg('user', 'first question'), // ~4 tokens
      mkMsg('assistant', 'first answer'), // ~3 tokens
      mkMsg('tool', bigToolContent, 'tc-big'), // ~100 tokens (will be truncated)
      mkMsg('user', 'second question'), // ~4 tokens
      mkMsg('assistant', 'second answer'), // ~3 tokens
    ]
    // Without truncation, budget 15 would only fit last 2-3 messages
    // With truncation (recentWindow=2), tool output shrinks, allowing more messages
    const result = trimHistory(history, 15, 2)
    // Should have more than just the last 2 messages
    expect(result.length).toBeGreaterThanOrEqual(3)
  })

  test('fallback: returns recentWindow messages when nothing fits in budget', () => {
    // All messages are huge — even truncated versions won't fit
    const big = 'z'.repeat(4000) // ~1000 tokens each
    const history = [
      mkMsg('user', big),
      mkMsg('assistant', big),
      mkMsg('user', big),
      mkMsg('assistant', big),
      mkMsg('user', 'latest question'),
    ]
    // Budget: 1 token. dropOldest returns 0 messages.
    // Fallback: return last recentWindow(2) messages from original history
    const result = trimHistory(history, 1, 2)
    expect(result).toHaveLength(2)
    expect(result[1]!.content).toBe('latest question')
  })

  test('preserves newest messages', () => {
    const history = [mkMsg('user', 'old'), mkMsg('user', 'mid'), mkMsg('user', 'new')]
    const result = trimHistory(history, 1)
    expect(result).toHaveLength(1)
    expect(result[0]!.content).toBe('new')
  })

  test('does not mutate original array', () => {
    const history = [mkMsg('user', 'a'.repeat(40)), mkMsg('user', 'b'.repeat(40))]
    const original = [...history]
    trimHistory(history, 10)
    expect(history).toEqual(original)
  })

  test('tool results within recent window are NOT truncated', () => {
    const bigToolContent = 'x'.repeat(400) // ~100 tokens
    const history = [
      mkMsg('user', 'old'),
      mkMsg('tool', bigToolContent, 'tc-recent'), // inside recentWindow of 3
      mkMsg('user', 'question'),
    ]
    // recentWindow=3 → all messages are "recent", no truncation
    const result = trimHistory(history, 200, 3)
    const toolMsg = result.find((m) => m.role === 'tool')
    expect(toolMsg?.content).toBe(bigToolContent) // NOT truncated
  })
})

// ============================================================================
// createSystemPromptContributor (structured)
// ============================================================================

describe('createSystemPromptContributor', () => {
  test('returns base prompt when no extras provided', () => {
    const contributor = createSystemPromptContributor({
      basePrompt: 'You are an assistant.',
      tools: [],
    })
    const segment = contributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment!.content).toBe('You are an assistant.')
  })

  test('includes tool descriptions', () => {
    const tools: ToolDefinition[] = [
      { type: 'function', function: { name: 'read_file', description: 'Read a file from disk' } },
      { type: 'function', function: { name: 'bash', description: 'Run a shell command' } },
    ]
    const contributor = createSystemPromptContributor({
      basePrompt: 'You are an assistant.',
      tools,
    })
    const segment = contributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment!.content).toContain('## Available Tools')
    expect(segment!.content).toContain('**read_file**: Read a file from disk')
    expect(segment!.content).toContain('**bash**: Run a shell command')
  })

  test('includes skills section', () => {
    const contributor = createSystemPromptContributor({
      basePrompt: 'Base.',
      tools: [],
      skills: [
        { name: 'code-patterns', description: 'Reference implementations' },
        { name: 'behavioral-core', description: 'BP coordination patterns' },
      ],
    })
    const segment = contributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment!.content).toContain('## Active Skills')
    expect(segment!.content).toContain('**code-patterns**: Reference implementations')
  })

  test('includes constitution rules', () => {
    const contributor = createSystemPromptContributor({
      basePrompt: 'Base.',
      tools: [],
      constitutionRules: ['Never delete production data', 'Always explain changes'],
    })
    const segment = contributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment!.content).toContain('## Constraints')
    expect(segment!.content).toContain('- Never delete production data')
  })

  test('includes search hint when enabled', () => {
    const contributor = createSystemPromptContributor({
      basePrompt: 'Base.',
      tools: [],
      searchHint: true,
    })
    const segment = contributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment!.content).toContain('search tool to query the hypergraph memory')
  })

  test('omits search hint by default', () => {
    const contributor = createSystemPromptContributor({
      basePrompt: 'Base.',
      tools: [],
    })
    const segment = contributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment!.content).not.toContain('search tool')
  })

  test('has priority 100 and name system_prompt', () => {
    const contributor = createSystemPromptContributor({ basePrompt: 'X', tools: [] })
    expect(contributor.priority).toBe(100)
    expect(contributor.name).toBe('system_prompt')
  })

  test('handles tools with no description', () => {
    const contributor = createSystemPromptContributor({
      basePrompt: 'Base.',
      tools: [{ type: 'function', function: { name: 'custom_tool' } }],
    })
    const segment = contributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment!.content).toContain('**custom_tool**:')
  })
})

// ============================================================================
// Integration: three-tier context assembly
// ============================================================================

describe('three-tier context assembly', () => {
  test('warm layer included when meta exists, all tiers ordered correctly', () => {
    const meta = mkMeta({ decisionCount: 7 })
    const sessionSummary = createSessionSummaryContributor(meta)

    const assemble = createContextAssembler([
      systemPromptContributor('You are helpful.'),
      rejectionContributor,
      sessionSummary,
      toolsContributor,
      planContributor,
      historyContributor,
    ])

    const state: ContextState = {
      history: [{ role: 'user', content: 'What did we do before?' }],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    }

    const result = assemble(state, 100_000)
    expect(result.included).toContain('system_prompt')
    expect(result.included).toContain('session_summary')
    expect(result.included).toContain('history')
    // session_summary should be in the output
    const summaryMsg = result.messages.find((m) => m.content?.includes('Session context'))
    expect(summaryMsg).toBeDefined()
    expect(summaryMsg!.content).toContain('7 decisions')
  })

  test('warm layer absent when no meta exists', () => {
    const sessionSummary = createSessionSummaryContributor(null)

    const assemble = createContextAssembler([
      systemPromptContributor('You are helpful.'),
      sessionSummary,
      historyContributor,
    ])

    const state: ContextState = {
      history: [{ role: 'user', content: 'Hello' }],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    }

    const result = assemble(state, 100_000)
    expect(result.included).not.toContain('session_summary')
    expect(result.messages).toHaveLength(2) // system_prompt + history
  })

  test('warm layer (priority 70) survives when history (priority 20) is trimmed', () => {
    const meta = mkMeta()
    const sessionSummary = createSessionSummaryContributor(meta)

    // System prompt ~25 tokens, session summary ~30 tokens, history ~100 tokens
    const assemble = createContextAssembler([
      systemPromptContributor('Short prompt.'),
      sessionSummary,
      historyContributor,
    ])

    const state: ContextState = {
      history: [{ role: 'user', content: 'x'.repeat(400) }], // ~100 tokens
      activeTools: [],
      constitution: [],
      priorRejections: [],
    }

    // Budget: enough for system prompt + warm layer, but not history
    const result = assemble(state, 80)
    expect(result.included).toContain('system_prompt')
    expect(result.included).toContain('session_summary')
    expect(result.excluded).toContain('history')
  })

  test('session summary priority (70) is between history (20) and rejections (80)', () => {
    const meta = mkMeta()
    const sessionSummary = createSessionSummaryContributor(meta)

    expect(sessionSummary.priority).toBe(70)
    expect(historyContributor.priority).toBe(20)
    expect(rejectionContributor.priority).toBe(80)

    // Under pressure, history drops first, then session summary, then rejections
    expect(historyContributor.priority).toBeLessThan(sessionSummary.priority)
    expect(sessionSummary.priority).toBeLessThan(rejectionContributor.priority)
  })
})
