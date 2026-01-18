import { describe, expect, test } from 'bun:test'
import type { ContentBlock, PlanEntry, SessionNotification, ToolCall } from '@agentclientprotocol/sdk'
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
  filterToolCallsByStatus,
  filterToolCallsByTitle,
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
    // Type narrowing to access text property
    if (content.type === 'text') {
      expect(content.text).toBe('Hello world')
    }
  })
})

describe('createImageContent', () => {
  test('creates image content with required fields', () => {
    const content = createImageContent('base64data', 'image/png')
    expect(content.type).toBe('image')
    if (content.type === 'image') {
      expect(content.data).toBe('base64data')
      expect(content.mimeType).toBe('image/png')
    }
  })
})

describe('createAudioContent', () => {
  test('creates audio content block', () => {
    const content = createAudioContent('audiodata', 'audio/wav')
    expect(content.type).toBe('audio')
    if (content.type === 'audio') {
      expect(content.data).toBe('audiodata')
      expect(content.mimeType).toBe('audio/wav')
    }
  })
})

describe('createResourceLink', () => {
  test('creates resource link with uri and name', () => {
    const content = createResourceLink({ uri: 'file:///path/to/file.ts', name: 'file.ts' })
    expect(content.type).toBe('resource_link')
    if (content.type === 'resource_link') {
      expect(content.uri).toBe('file:///path/to/file.ts')
      expect(content.name).toBe('file.ts')
    }
  })

  test('includes optional mimeType', () => {
    const content = createResourceLink({ uri: 'file:///path/to/file.ts', name: 'file.ts', mimeType: 'text/typescript' })
    if (content.type === 'resource_link') {
      expect(content.mimeType).toBe('text/typescript')
    }
  })
})

describe('createTextResource', () => {
  test('creates embedded text resource', () => {
    const content = createTextResource({ uri: 'file:///src/main.ts', text: 'const x = 1;' })
    expect(content.type).toBe('resource')
    if (content.type === 'resource') {
      expect(content.resource.uri).toBe('file:///src/main.ts')
      expect('text' in content.resource && content.resource.text).toBe('const x = 1;')
    }
  })

  test('includes optional mimeType', () => {
    const content = createTextResource({
      uri: 'file:///src/main.ts',
      text: 'const x = 1;',
      mimeType: 'text/typescript',
    })
    if (content.type === 'resource' && 'text' in content.resource) {
      expect(content.resource.mimeType).toBe('text/typescript')
    }
  })
})

describe('createBlobResource', () => {
  test('creates embedded blob resource', () => {
    const content = createBlobResource({ uri: 'file:///image.png', blob: 'base64blobdata' })
    expect(content.type).toBe('resource')
    if (content.type === 'resource' && 'blob' in content.resource) {
      expect(content.resource.uri).toBe('file:///image.png')
      expect(content.resource.blob).toBe('base64blobdata')
    }
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
  test('extracts text from agent message chunks', () => {
    const notifications: SessionNotification[] = [
      {
        sessionId: 's1',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'First' } },
      },
      {
        sessionId: 's1',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Second' } },
      },
    ]
    expect(extractTextFromUpdates(notifications)).toBe('FirstSecond')
  })

  test('skips non-text content updates', () => {
    const notifications: SessionNotification[] = [
      {
        sessionId: 's1',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello' } },
      },
      {
        sessionId: 's1',
        update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'read_file', status: 'pending' },
      },
      {
        sessionId: 's1',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'World' } },
      },
    ]
    expect(extractTextFromUpdates(notifications)).toBe('HelloWorld')
  })
})

describe('extractToolCalls', () => {
  test('extracts all tool calls from notifications', () => {
    const notifications: SessionNotification[] = [
      {
        sessionId: 's1',
        update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'read_file', status: 'completed' },
      },
      {
        sessionId: 's1',
        update: { sessionUpdate: 'tool_call', toolCallId: 't2', title: 'write_file', status: 'in_progress' },
      },
    ]
    const calls = extractToolCalls(notifications)
    expect(calls).toHaveLength(2)
    expect(calls[0]?.title).toBe('read_file')
    expect(calls[1]?.title).toBe('write_file')
  })

  test('returns empty array when no tool calls', () => {
    const notifications: SessionNotification[] = [
      {
        sessionId: 's1',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hello' } },
      },
    ]
    expect(extractToolCalls(notifications)).toEqual([])
  })
})

describe('extractLatestToolCalls', () => {
  test('returns latest state of each tool call', () => {
    const notifications: SessionNotification[] = [
      {
        sessionId: 's1',
        update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'read_file', status: 'pending' },
      },
      {
        sessionId: 's1',
        update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'read_file', status: 'in_progress' },
      },
      {
        sessionId: 's1',
        update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'read_file', status: 'completed' },
      },
    ]
    const latest = extractLatestToolCalls(notifications)
    expect(latest.size).toBe(1)
    expect(latest.get('t1')?.status).toBe('completed')
  })

  test('tracks multiple tool calls independently', () => {
    const notifications: SessionNotification[] = [
      {
        sessionId: 's1',
        update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'read_file', status: 'completed' },
      },
      {
        sessionId: 's1',
        update: { sessionUpdate: 'tool_call', toolCallId: 't2', title: 'write_file', status: 'in_progress' },
      },
    ]
    const latest = extractLatestToolCalls(notifications)
    expect(latest.size).toBe(2)
    expect(latest.get('t1')?.status).toBe('completed')
    expect(latest.get('t2')?.status).toBe('in_progress')
  })
})

describe('extractPlan', () => {
  test('returns latest plan from notifications', () => {
    const notifications: SessionNotification[] = [
      {
        sessionId: 's1',
        update: {
          sessionUpdate: 'plan',
          entries: [{ content: 'Step 1', status: 'pending', priority: 'medium' }],
        },
      },
      {
        sessionId: 's1',
        update: {
          sessionUpdate: 'plan',
          entries: [
            { content: 'Step 1', status: 'completed', priority: 'medium' },
            { content: 'Step 2', status: 'in_progress', priority: 'medium' },
          ],
        },
      },
    ]
    const plan = extractPlan(notifications)
    expect(plan).toHaveLength(2)
    expect(plan?.[0]?.status).toBe('completed')
  })

  test('returns undefined when no plan in updates', () => {
    const notifications: SessionNotification[] = [
      {
        sessionId: 's1',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Hi' } },
      },
    ]
    expect(extractPlan(notifications)).toBeUndefined()
  })
})

// ============================================================================
// Tool Call Utilities
// ============================================================================

describe('filterToolCallsByStatus', () => {
  const toolCalls: ToolCall[] = [
    { toolCallId: 't1', title: 'a', status: 'completed' },
    { toolCallId: 't2', title: 'b', status: 'failed' },
    { toolCallId: 't3', title: 'c', status: 'completed' },
  ]

  test('filters by completed status', () => {
    const result = filterToolCallsByStatus(toolCalls, 'completed')
    expect(result).toHaveLength(2)
    expect(result.every((c) => c.status === 'completed')).toBe(true)
  })

  test('filters by failed status', () => {
    const result = filterToolCallsByStatus(toolCalls, 'failed')
    expect(result).toHaveLength(1)
    expect(result[0]?.title).toBe('b')
  })
})

describe('filterToolCallsByTitle', () => {
  const toolCalls: ToolCall[] = [
    { toolCallId: 't1', title: 'read_file', status: 'completed' },
    { toolCallId: 't2', title: 'write_file', status: 'completed' },
    { toolCallId: 't3', title: 'read_file', status: 'completed' },
  ]

  test('filters by tool title', () => {
    const result = filterToolCallsByTitle(toolCalls, 'read_file')
    expect(result).toHaveLength(2)
  })
})

describe('hasToolCallErrors', () => {
  test('returns true when failed tool calls exist', () => {
    const toolCalls: ToolCall[] = [
      { toolCallId: 't1', title: 'a', status: 'completed' },
      { toolCallId: 't2', title: 'b', status: 'failed' },
    ]
    expect(hasToolCallErrors(toolCalls)).toBe(true)
  })

  test('returns false when no failed tool calls', () => {
    const toolCalls: ToolCall[] = [
      { toolCallId: 't1', title: 'a', status: 'completed' },
      { toolCallId: 't2', title: 'b', status: 'completed' },
    ]
    expect(hasToolCallErrors(toolCalls)).toBe(false)
  })
})

describe('getCompletedToolCallsWithContent', () => {
  test('returns completed calls with content', () => {
    const toolCalls: ToolCall[] = [
      {
        toolCallId: 't1',
        title: 'read',
        status: 'completed',
        content: [{ type: 'content', content: { type: 'text', text: 'file content' } }],
      },
      { toolCallId: 't2', title: 'write', status: 'completed' },
      { toolCallId: 't3', title: 'fetch', status: 'in_progress' },
    ]
    const result = getCompletedToolCallsWithContent(toolCalls)
    expect(result).toHaveLength(1)
    expect(result[0]?.title).toBe('read')
  })
})

// ============================================================================
// Plan Utilities
// ============================================================================

describe('filterPlanByStatus', () => {
  const plan: PlanEntry[] = [
    { content: 'Step 1', status: 'completed', priority: 'high' },
    { content: 'Step 2', status: 'in_progress', priority: 'medium' },
    { content: 'Step 3', status: 'pending', priority: 'low' },
  ]

  test('filters by status', () => {
    expect(filterPlanByStatus(plan, 'completed')).toHaveLength(1)
    expect(filterPlanByStatus(plan, 'pending')).toHaveLength(1)
  })
})

describe('getPlanProgress', () => {
  test('calculates completion percentage', () => {
    const plan: PlanEntry[] = [
      { content: 'Step 1', status: 'completed', priority: 'high' },
      { content: 'Step 2', status: 'completed', priority: 'high' },
      { content: 'Step 3', status: 'pending', priority: 'medium' },
      { content: 'Step 4', status: 'pending', priority: 'low' },
    ]
    expect(getPlanProgress(plan)).toBe(50)
  })

  test('returns 100 for empty plan', () => {
    expect(getPlanProgress([])).toBe(100)
  })

  test('returns 100 for all completed', () => {
    const plan: PlanEntry[] = [
      { content: 'Step 1', status: 'completed', priority: 'high' },
      { content: 'Step 2', status: 'completed', priority: 'medium' },
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
    const prompt = createPromptWithImage({ text: 'Describe this', imageData: 'base64img', mimeType: 'image/png' })
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
    const notifications: SessionNotification[] = [
      {
        sessionId: 's1',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Processing...' } },
      },
      {
        sessionId: 's1',
        update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'read', status: 'in_progress' },
      },
      {
        sessionId: 's1',
        update: {
          sessionUpdate: 'plan',
          entries: [{ content: 'Step 1', status: 'in_progress', priority: 'high' }],
        },
      },
      {
        sessionId: 's1',
        update: { sessionUpdate: 'agent_message_chunk', content: { type: 'text', text: 'Done!' } },
      },
      {
        sessionId: 's1',
        update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'read', status: 'completed' },
      },
      {
        sessionId: 's1',
        update: {
          sessionUpdate: 'plan',
          entries: [{ content: 'Step 1', status: 'completed', priority: 'high' }],
        },
      },
    ]

    const summary = summarizeResponse(notifications)

    expect(summary.text).toBe('Processing...Done!')
    expect(summary.toolCallCount).toBe(1)
    expect(summary.completedToolCalls).toHaveLength(1)
    expect(summary.failedToolCalls).toHaveLength(0)
    expect(summary.plan).toHaveLength(1)
    expect(summary.planProgress).toBe(100)
    expect(summary.hasErrors).toBe(false)
  })

  test('detects errors in summary', () => {
    const notifications: SessionNotification[] = [
      {
        sessionId: 's1',
        update: { sessionUpdate: 'tool_call', toolCallId: 't1', title: 'read', status: 'failed' },
      },
    ]

    const summary = summarizeResponse(notifications)
    expect(summary.hasErrors).toBe(true)
    expect(summary.failedToolCalls).toHaveLength(1)
  })
})
