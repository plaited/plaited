import { describe, expect, test } from 'bun:test'
import type { SessionNotification } from '@agentclientprotocol/sdk'
import { createPrompt, createPromptWithFiles, createPromptWithImage, summarizeResponse } from '../acp-helpers.ts'

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
