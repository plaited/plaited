import { describe, expect, test } from 'bun:test'
import type { ChatMessage, ContextContributor, ContextState } from 'plaited'
import {
  assembleContext,
  createContextAssembler,
  estimateTokens,
  historyContributor,
  planContributor,
  rejectionContributor,
  systemPromptContributor,
  toolsContributor,
  trimHistory,
} from 'plaited'

describe('estimateTokens', () => {
  test('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0)
  })

  test('returns at least 1 for non-empty string', () => {
    expect(estimateTokens('hi')).toBe(1)
  })

  test('estimates ~4 chars per token', () => {
    // 100 chars → 25 tokens
    const text = 'a'.repeat(100)
    expect(estimateTokens(text)).toBe(25)
  })

  test('rounds up partial tokens', () => {
    // 5 chars → ceil(5/4) = 2 tokens
    expect(estimateTokens('hello')).toBe(2)
  })
})

describe('systemPromptContributor', () => {
  test('returns system segment with the prompt text', () => {
    const contributor = systemPromptContributor('You are an AI assistant.')
    const segment = contributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment).not.toBeNull()
    expect(segment!.role).toBe('system')
    expect(segment!.content).toBe('You are an AI assistant.')
    expect(segment!.tokenEstimate).toBeGreaterThan(0)
  })

  test('has highest priority (100)', () => {
    const contributor = systemPromptContributor('test')
    expect(contributor.priority).toBe(100)
  })

  test('has name system_prompt', () => {
    const contributor = systemPromptContributor('test')
    expect(contributor.name).toBe('system_prompt')
  })
})

describe('rejectionContributor', () => {
  test('returns null when no rejections', () => {
    const segment = rejectionContributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment).toBeNull()
  })

  test('returns system segment with formatted rejections', () => {
    const segment = rejectionContributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: ['Cannot delete /etc', 'Bash command too dangerous'],
    })
    expect(segment).not.toBeNull()
    expect(segment!.role).toBe('system')
    expect(segment!.content).toContain('Prior rejections')
    expect(segment!.content).toContain('[Rejection 1] Cannot delete /etc')
    expect(segment!.content).toContain('[Rejection 2] Bash command too dangerous')
  })

  test('has priority 80', () => {
    expect(rejectionContributor.priority).toBe(80)
  })
})

describe('toolsContributor', () => {
  test('returns null when no tools', () => {
    const segment = toolsContributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment).toBeNull()
  })

  test('returns system segment with tool definitions', () => {
    const tools = [
      {
        type: 'function' as const,
        function: { name: 'read_file', description: 'Read a file' },
      },
    ]
    const segment = toolsContributor.contribute({
      history: [],
      activeTools: tools,
      constitution: [],
      priorRejections: [],
    })
    expect(segment).not.toBeNull()
    expect(segment!.role).toBe('system')
    expect(segment!.content).toContain('Available tools')
    expect(segment!.content).toContain('read_file')
  })

  test('has priority 60', () => {
    expect(toolsContributor.priority).toBe(60)
  })
})

describe('planContributor', () => {
  test('returns null when no plan', () => {
    const segment = planContributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment).toBeNull()
  })

  test('returns system segment with plan steps', () => {
    const segment = planContributor.contribute({
      history: [],
      plan: {
        goal: 'Fix the bug',
        steps: [
          { id: 's1', intent: 'Read the file', tools: ['read_file'] },
          { id: 's2', intent: 'Edit the code', tools: ['edit_file'], depends: ['s1'] },
        ],
      },
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment).not.toBeNull()
    expect(segment!.role).toBe('system')
    expect(segment!.content).toContain('Fix the bug')
    expect(segment!.content).toContain('[s1] Read the file')
    expect(segment!.content).toContain('depends: s1')
  })

  test('has priority 40', () => {
    expect(planContributor.priority).toBe(40)
  })
})

describe('historyContributor', () => {
  test('returns null when no history', () => {
    const segment = historyContributor.contribute({
      history: [],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment).toBeNull()
  })

  test('returns user segment with formatted history', () => {
    const history: ChatMessage[] = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' },
    ]
    const segment = historyContributor.contribute({
      history,
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment).not.toBeNull()
    expect(segment!.role).toBe('user')
    expect(segment!.content).toContain('[user] Hello')
    expect(segment!.content).toContain('[assistant] Hi there')
  })

  test('has lowest priority (20)', () => {
    expect(historyContributor.priority).toBe(20)
  })

  test('handles messages with null content', () => {
    const history: ChatMessage[] = [{ role: 'assistant', content: null }]
    const segment = historyContributor.contribute({
      history,
      activeTools: [],
      constitution: [],
      priorRejections: [],
    })
    expect(segment).not.toBeNull()
    expect(segment!.content).toContain('[assistant]')
  })
})

describe('trimHistory', () => {
  const mkMsg = (content: string): ChatMessage => ({ role: 'user', content })

  test('returns empty array for zero budget', () => {
    expect(trimHistory([mkMsg('hello')], 0)).toEqual([])
  })

  test('returns all messages when within budget', () => {
    const history = [mkMsg('hi'), mkMsg('there')]
    const result = trimHistory(history, 10000)
    expect(result).toEqual(history)
  })

  test('drops oldest messages first when over budget', () => {
    // Each message is 'x'.repeat(40) → 10 tokens each
    const history = [mkMsg('a'.repeat(40)), mkMsg('b'.repeat(40)), mkMsg('c'.repeat(40))]
    // Budget for ~2 messages (20 tokens)
    const result = trimHistory(history, 20)
    expect(result).toHaveLength(2)
    expect(result[0]!.content).toBe('b'.repeat(40))
    expect(result[1]!.content).toBe('c'.repeat(40))
  })

  test('preserves newest messages', () => {
    const history = [mkMsg('old'), mkMsg('mid'), mkMsg('new')]
    // Budget for 1 message
    const result = trimHistory(history, 1)
    expect(result).toHaveLength(1)
    expect(result[0]!.content).toBe('new')
  })

  test('does not mutate original array', () => {
    const history = [mkMsg('a'.repeat(40)), mkMsg('b'.repeat(40))]
    const original = [...history]
    trimHistory(history, 10)
    expect(history).toEqual(original)
  })
})

describe('assembleContext', () => {
  const mkContributor = (name: string, priority: number, tokens: number): ContextContributor => ({
    name,
    priority,
    contribute: () => ({
      role: 'system',
      content: 'x'.repeat(tokens * 4),
      tokenEstimate: tokens,
    }),
  })

  test('includes all segments when within budget', () => {
    const contributors = [mkContributor('a', 50, 10), mkContributor('b', 30, 10)]
    const result = assembleContext(contributors, 100)
    expect(result.included).toEqual(['a', 'b'])
    expect(result.excluded).toEqual([])
    expect(result.messages).toHaveLength(2)
    expect(result.totalTokenEstimate).toBe(20)
  })

  test('excludes lowest-priority segments when over budget', () => {
    const contributors = [mkContributor('high', 100, 30), mkContributor('low', 10, 30), mkContributor('mid', 50, 30)]
    // Budget for 2 of 3 (60 tokens)
    const result = assembleContext(contributors, 60)
    expect(result.included).toContain('high')
    expect(result.included).toContain('mid')
    expect(result.excluded).toEqual(['low'])
    expect(result.messages).toHaveLength(2)
  })

  test('preserves original contributor order in messages', () => {
    // Contributors ordered: low, high, mid
    // Priority keeps high + mid, but messages should be in original order: high, mid
    const contributors = [mkContributor('low', 10, 30), mkContributor('high', 100, 30), mkContributor('mid', 50, 30)]
    const result = assembleContext(contributors, 60)
    // Original order: low(index 0), high(index 1), mid(index 2)
    // Included: high(index 1), mid(index 2) — messages in index order
    expect(result.messages).toHaveLength(2)
    expect(result.included[0]).toBe('high')
    expect(result.included[1]).toBe('mid')
  })

  test('skips contributors that return null', () => {
    const nullContributor: ContextContributor = {
      name: 'empty',
      priority: 90,
      contribute: () => null,
    }
    const contributors = [nullContributor, mkContributor('real', 50, 10)]
    const result = assembleContext(contributors, 100)
    expect(result.included).toEqual(['real'])
    expect(result.messages).toHaveLength(1)
  })

  test('returns empty result for zero budget', () => {
    const contributors = [mkContributor('a', 50, 10)]
    const result = assembleContext(contributors, 0)
    expect(result.messages).toHaveLength(0)
    expect(result.excluded).toEqual(['a'])
  })

  test('returns empty result for no contributors', () => {
    const result = assembleContext([], 1000)
    expect(result.messages).toHaveLength(0)
    expect(result.included).toEqual([])
    expect(result.totalTokenEstimate).toBe(0)
  })

  test('handles exact budget match', () => {
    const contributors = [mkContributor('a', 50, 50)]
    const result = assembleContext(contributors, 50)
    expect(result.included).toEqual(['a'])
    expect(result.totalTokenEstimate).toBe(50)
  })
})

describe('createContextAssembler', () => {
  test('creates assembler bound to contributors', () => {
    const assemble = createContextAssembler([
      systemPromptContributor('You are helpful.'),
      rejectionContributor,
      historyContributor,
    ])

    const state: ContextState = {
      history: [{ role: 'user', content: 'Hello' }],
      activeTools: [],
      constitution: [],
      priorRejections: ['Do not rm -rf'],
    }

    const result = assemble(state, 10000)
    expect(result.included).toContain('system_prompt')
    expect(result.included).toContain('rejections')
    expect(result.included).toContain('history')
    expect(result.messages.length).toBeGreaterThan(0)
  })

  test('respects budget and trims low-priority segments', () => {
    const assemble = createContextAssembler([
      systemPromptContributor('x'.repeat(400)), // ~100 tokens, priority 100
      historyContributor, // priority 20
    ])

    const state: ContextState = {
      history: [{ role: 'user', content: 'y'.repeat(400) }],
      activeTools: [],
      constitution: [],
      priorRejections: [],
    }

    // Budget tight enough for system prompt but not history
    const result = assemble(state, 110)
    expect(result.included).toContain('system_prompt')
    expect(result.excluded).toContain('history')
  })

  test('passes full state to all contributors', () => {
    const plan = {
      goal: 'Test',
      steps: [{ id: 's1', intent: 'Do thing', tools: ['bash'] }],
    }

    const assemble = createContextAssembler([
      systemPromptContributor('prompt'),
      rejectionContributor,
      toolsContributor,
      planContributor,
      historyContributor,
    ])

    const state: ContextState = {
      history: [{ role: 'user', content: 'go' }],
      plan,
      activeTools: [{ type: 'function', function: { name: 'bash' } }],
      constitution: ['no rm -rf'],
      priorRejections: ['blocked: dangerous command'],
    }

    const result = assemble(state, 100000)
    expect(result.included).toEqual(['system_prompt', 'rejections', 'tools', 'plan', 'history'])
    expect(result.excluded).toEqual([])
    expect(result.messages).toHaveLength(5)
  })
})
