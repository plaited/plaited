import { describe, expect, test } from 'bun:test'
import type { ContentBlock, PlanEntry, SessionUpdateParams, ToolCall } from '../acp.types.ts'
import {
  createAudioContent,
  createBlobResource,
  createImageContent,
  createPrompt,
  createPromptWithFiles,
  createPromptWithImage,
  createResourceLink,
  createTextContent,
  createTextResource,
  extractLatestToolCalls,
  extractPlan,
  extractText,
  extractTextFromUpdates,
  extractToolCalls,
  filterPlanByStatus,
  filterToolCallsByName,
  filterToolCallsByStatus,
  getCompletedToolCallsWithContent,
  getPlanProgress,
  hasToolCallErrors,
  summarizeResponse,
} from '../acp-helpers.ts'

// ============================================================================
// Content Block Builders
// ============================================================================

describe('createTextContent', () => {
  test('creates text content block', () => {
    const content = createTextContent('Hello world')
    expect(content.type).toBe('text')
    expect(content.text).toBe('Hello world')
  })
})

describe('createImageContent', () => {
  test('creates image content with required fields', () => {
    const content = createImageContent('base64data', 'image/png')
    expect(content.type).toBe('image')
    expect(content.data).toBe('base64data')
    expect(content.mimeType).toBe('image/png')
    expect(content.uri).toBeUndefined()
  })

  test('includes optional uri', () => {
    const content = createImageContent('base64data', 'image/jpeg', 'https://example.com/img.jpg')
    expect(content.uri).toBe('https://example.com/img.jpg')
  })
})

describe('createAudioContent', () => {
  test('creates audio content block', () => {
    const content = createAudioContent('audiodata', 'audio/wav')
    expect(content.type).toBe('audio')
    expect(content.data).toBe('audiodata')
    expect(content.mimeType).toBe('audio/wav')
  })
})

describe('createResourceLink', () => {
  test('creates resource link with uri only', () => {
    const content = createResourceLink('file:///path/to/file.ts')
    expect(content.type).toBe('resource_link')
    expect(content.uri).toBe('file:///path/to/file.ts')
    expect(content.mimeType).toBeUndefined()
  })

  test('includes optional mimeType', () => {
    const content = createResourceLink('file:///path/to/file.ts', 'text/typescript')
    expect(content.mimeType).toBe('text/typescript')
  })
})

describe('createTextResource', () => {
  test('creates embedded text resource', () => {
    const content = createTextResource('file:///src/main.ts', 'const x = 1;')
    expect(content.type).toBe('resource')
    expect(content.resource).toEqual({
      uri: 'file:///src/main.ts',
      text: 'const x = 1;',
    })
  })

  test('includes optional mimeType', () => {
    const content = createTextResource('file:///src/main.ts', 'const x = 1;', 'text/typescript')
    expect(content.resource).toEqual({
      uri: 'file:///src/main.ts',
      text: 'const x = 1;',
      mimeType: 'text/typescript',
    })
  })
})

describe('createBlobResource', () => {
  test('creates embedded blob resource', () => {
    const content = createBlobResource('file:///image.png', 'base64blobdata')
    expect(content.type).toBe('resource')
    expect(content.resource).toEqual({
      uri: 'file:///image.png',
      blob: 'base64blobdata',
    })
  })
})

// ============================================================================
// Content Extraction
// ============================================================================

describe('extractText', () => {
  test('extracts text from text content blocks', () => {
    const content: ContentBlock[] = [
      { type: 'text', text: 'Hello' },
      { type: 'text', text: 'World' },
    ]
    expect(extractText(content)).toBe('Hello\nWorld')
  })

  test('ignores non-text content blocks', () => {
    const content: ContentBlock[] = [
      { type: 'text', text: 'Hello' },
      { type: 'image', data: 'base64', mimeType: 'image/png' },
      { type: 'text', text: 'World' },
    ]
    expect(extractText(content)).toBe('Hello\nWorld')
  })

  test('returns empty string for no text blocks', () => {
    const content: ContentBlock[] = [{ type: 'image', data: 'base64', mimeType: 'image/png' }]
    expect(extractText(content)).toBe('')
  })

  test('handles empty array', () => {
    expect(extractText([])).toBe('')
  })
})

describe('extractTextFromUpdates', () => {
  test('extracts text from all updates', () => {
    const updates: SessionUpdateParams[] = [
      { sessionId: 's1', content: [{ type: 'text', text: 'First' }] },
      { sessionId: 's1', content: [{ type: 'text', text: 'Second' }] },
    ]
    expect(extractTextFromUpdates(updates)).toBe('First\nSecond')
  })

  test('skips updates without content', () => {
    const updates: SessionUpdateParams[] = [
      { sessionId: 's1', content: [{ type: 'text', text: 'Hello' }] },
      { sessionId: 's1', toolCalls: [] },
      { sessionId: 's1', content: [{ type: 'text', text: 'World' }] },
    ]
    expect(extractTextFromUpdates(updates)).toBe('Hello\nWorld')
  })
})

describe('extractToolCalls', () => {
  test('extracts all tool calls from updates', () => {
    const updates: SessionUpdateParams[] = [
      {
        sessionId: 's1',
        toolCalls: [{ id: 't1', name: 'read_file', status: 'completed' }],
      },
      {
        sessionId: 's1',
        toolCalls: [{ id: 't2', name: 'write_file', status: 'in_progress' }],
      },
    ]
    const calls = extractToolCalls(updates)
    expect(calls).toHaveLength(2)
    expect(calls[0]?.name).toBe('read_file')
    expect(calls[1]?.name).toBe('write_file')
  })

  test('returns empty array when no tool calls', () => {
    const updates: SessionUpdateParams[] = [{ sessionId: 's1', content: [{ type: 'text', text: 'Hello' }] }]
    expect(extractToolCalls(updates)).toEqual([])
  })
})

describe('extractLatestToolCalls', () => {
  test('returns latest state of each tool call', () => {
    const updates: SessionUpdateParams[] = [
      {
        sessionId: 's1',
        toolCalls: [{ id: 't1', name: 'read_file', status: 'pending' }],
      },
      {
        sessionId: 's1',
        toolCalls: [{ id: 't1', name: 'read_file', status: 'in_progress' }],
      },
      {
        sessionId: 's1',
        toolCalls: [{ id: 't1', name: 'read_file', status: 'completed' }],
      },
    ]
    const latest = extractLatestToolCalls(updates)
    expect(latest.size).toBe(1)
    expect(latest.get('t1')?.status).toBe('completed')
  })

  test('tracks multiple tool calls independently', () => {
    const updates: SessionUpdateParams[] = [
      {
        sessionId: 's1',
        toolCalls: [
          { id: 't1', name: 'read_file', status: 'completed' },
          { id: 't2', name: 'write_file', status: 'in_progress' },
        ],
      },
    ]
    const latest = extractLatestToolCalls(updates)
    expect(latest.size).toBe(2)
    expect(latest.get('t1')?.status).toBe('completed')
    expect(latest.get('t2')?.status).toBe('in_progress')
  })
})

describe('extractPlan', () => {
  test('returns latest plan from updates', () => {
    const updates: SessionUpdateParams[] = [
      {
        sessionId: 's1',
        plan: [{ content: 'Step 1', status: 'pending' }],
      },
      {
        sessionId: 's1',
        plan: [
          { content: 'Step 1', status: 'completed' },
          { content: 'Step 2', status: 'in_progress' },
        ],
      },
    ]
    const plan = extractPlan(updates)
    expect(plan).toHaveLength(2)
    expect(plan?.[0]?.status).toBe('completed')
  })

  test('returns undefined when no plan in updates', () => {
    const updates: SessionUpdateParams[] = [{ sessionId: 's1', content: [{ type: 'text', text: 'Hi' }] }]
    expect(extractPlan(updates)).toBeUndefined()
  })
})

// ============================================================================
// Tool Call Utilities
// ============================================================================

describe('filterToolCallsByStatus', () => {
  const toolCalls: ToolCall[] = [
    { id: 't1', name: 'a', status: 'completed' },
    { id: 't2', name: 'b', status: 'error' },
    { id: 't3', name: 'c', status: 'completed' },
  ]

  test('filters by completed status', () => {
    const result = filterToolCallsByStatus(toolCalls, 'completed')
    expect(result).toHaveLength(2)
    expect(result.every((c) => c.status === 'completed')).toBe(true)
  })

  test('filters by error status', () => {
    const result = filterToolCallsByStatus(toolCalls, 'error')
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('b')
  })
})

describe('filterToolCallsByName', () => {
  const toolCalls: ToolCall[] = [
    { id: 't1', name: 'read_file', status: 'completed' },
    { id: 't2', name: 'write_file', status: 'completed' },
    { id: 't3', name: 'read_file', status: 'completed' },
  ]

  test('filters by tool name', () => {
    const result = filterToolCallsByName(toolCalls, 'read_file')
    expect(result).toHaveLength(2)
  })
})

describe('hasToolCallErrors', () => {
  test('returns true when errors exist', () => {
    const toolCalls: ToolCall[] = [
      { id: 't1', name: 'a', status: 'completed' },
      { id: 't2', name: 'b', status: 'error' },
    ]
    expect(hasToolCallErrors(toolCalls)).toBe(true)
  })

  test('returns false when no errors', () => {
    const toolCalls: ToolCall[] = [
      { id: 't1', name: 'a', status: 'completed' },
      { id: 't2', name: 'b', status: 'completed' },
    ]
    expect(hasToolCallErrors(toolCalls)).toBe(false)
  })
})

describe('getCompletedToolCallsWithContent', () => {
  test('returns completed calls with content', () => {
    const toolCalls: ToolCall[] = [
      {
        id: 't1',
        name: 'read',
        status: 'completed',
        content: [{ type: 'text', text: 'file content' }],
      },
      { id: 't2', name: 'write', status: 'completed' },
      { id: 't3', name: 'fetch', status: 'in_progress' },
    ]
    const result = getCompletedToolCallsWithContent(toolCalls)
    expect(result).toHaveLength(1)
    expect(result[0]?.name).toBe('read')
  })
})

// ============================================================================
// Plan Utilities
// ============================================================================

describe('filterPlanByStatus', () => {
  const plan: PlanEntry[] = [
    { content: 'Step 1', status: 'completed' },
    { content: 'Step 2', status: 'in_progress' },
    { content: 'Step 3', status: 'pending' },
  ]

  test('filters by status', () => {
    expect(filterPlanByStatus(plan, 'completed')).toHaveLength(1)
    expect(filterPlanByStatus(plan, 'pending')).toHaveLength(1)
  })
})

describe('getPlanProgress', () => {
  test('calculates completion percentage', () => {
    const plan: PlanEntry[] = [
      { content: 'Step 1', status: 'completed' },
      { content: 'Step 2', status: 'completed' },
      { content: 'Step 3', status: 'pending' },
      { content: 'Step 4', status: 'pending' },
    ]
    expect(getPlanProgress(plan)).toBe(50)
  })

  test('returns 100 for empty plan', () => {
    expect(getPlanProgress([])).toBe(100)
  })

  test('returns 100 for all completed', () => {
    const plan: PlanEntry[] = [
      { content: 'Step 1', status: 'completed' },
      { content: 'Step 2', status: 'completed' },
    ]
    expect(getPlanProgress(plan)).toBe(100)
  })
})

// ============================================================================
// Prompt Building Utilities
// ============================================================================

describe('createPrompt', () => {
  test('creates single text block prompt', () => {
    const prompt = createPrompt('Hello agent')
    expect(prompt).toHaveLength(1)
    expect(prompt[0]).toEqual({ type: 'text', text: 'Hello agent' })
  })
})

describe('createPromptWithFiles', () => {
  test('creates prompt with file context', () => {
    const prompt = createPromptWithFiles('Analyze this', [
      { path: '/src/main.ts', content: 'const x = 1;' },
      { path: '/src/utils.ts', content: 'export const y = 2;' },
    ])
    expect(prompt).toHaveLength(3)
    expect(prompt[0]).toEqual({ type: 'text', text: 'Analyze this' })
    expect(prompt[1]?.type).toBe('resource')
    expect(prompt[2]?.type).toBe('resource')
  })
})

describe('createPromptWithImage', () => {
  test('creates prompt with image', () => {
    const prompt = createPromptWithImage('Describe this', 'base64img', 'image/png')
    expect(prompt).toHaveLength(2)
    expect(prompt[0]).toEqual({ type: 'text', text: 'Describe this' })
    expect(prompt[1]).toEqual({
      type: 'image',
      data: 'base64img',
      mimeType: 'image/png',
    })
  })
})

// ============================================================================
// Response Analysis
// ============================================================================

describe('summarizeResponse', () => {
  test('creates comprehensive summary', () => {
    const updates: SessionUpdateParams[] = [
      {
        sessionId: 's1',
        content: [{ type: 'text', text: 'Processing...' }],
        toolCalls: [{ id: 't1', name: 'read', status: 'in_progress' }],
        plan: [{ content: 'Step 1', status: 'in_progress' }],
      },
      {
        sessionId: 's1',
        content: [{ type: 'text', text: 'Done!' }],
        toolCalls: [{ id: 't1', name: 'read', status: 'completed' }],
        plan: [{ content: 'Step 1', status: 'completed' }],
      },
    ]

    const summary = summarizeResponse(updates)

    expect(summary.text).toBe('Processing...\nDone!')
    expect(summary.toolCallCount).toBe(1)
    expect(summary.completedToolCalls).toHaveLength(1)
    expect(summary.erroredToolCalls).toHaveLength(0)
    expect(summary.plan).toHaveLength(1)
    expect(summary.planProgress).toBe(100)
    expect(summary.hasErrors).toBe(false)
  })

  test('detects errors in summary', () => {
    const updates: SessionUpdateParams[] = [
      {
        sessionId: 's1',
        toolCalls: [{ id: 't1', name: 'read', status: 'error' }],
      },
    ]

    const summary = summarizeResponse(updates)
    expect(summary.hasErrors).toBe(true)
    expect(summary.erroredToolCalls).toHaveLength(1)
  })
})
