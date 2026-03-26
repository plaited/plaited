import { describe, expect, test } from 'bun:test'

type PiRpcEvent = {
  type?: string
  message?: unknown
  messages?: unknown
  text?: string
  content?: string
  delta?: string
}

const extractAssistantMessageText = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = extractAssistantMessageText(item)
      if (text) {
        return text
      }
    }
    return null
  }

  if (typeof value !== 'object' || value === null) {
    return null
  }

  const message = value as {
    role?: unknown
    content?: unknown
  }

  if (message.role !== 'assistant' || !Array.isArray(message.content)) {
    return null
  }

  const text = message.content
    .flatMap((item) => {
      if (typeof item !== 'object' || item === null) {
        return []
      }
      const block = item as { type?: unknown; text?: unknown }
      return block.type === 'text' && typeof block.text === 'string' ? [block.text] : []
    })
    .join('')
    .trim()

  return text || null
}

const choosePromptText = (events: PiRpcEvent[], textParts: string[]): string => {
  let finalAssistantText: string | null = null

  for (const event of events) {
    const record = event as Record<string, unknown>
    const finalText =
      (event.type === 'message_end' ? extractAssistantMessageText(record.message) : null) ??
      (event.type === 'agent_end' ? extractAssistantMessageText(record.messages) : null)
    if (finalText) {
      finalAssistantText = finalText
    }
  }

  return finalAssistantText ?? textParts.join('').trim()
}

describe('modnet Pi rpc parsing strategy', () => {
  test('prefers final assistant text over concatenated deltas', () => {
    const events: PiRpcEvent[] = [
      { type: 'message_update', delta: '{"rewriteBrief":"abc' },
      { type: 'message_update', delta: 'def"}' },
      {
        type: 'message_end',
        message: {
          role: 'assistant',
          content: [{ type: 'text', text: '{"rewriteBrief":"abcdef"}' }],
        },
      },
    ]

    const text = choosePromptText(events, ['{"rewriteBrief":"abc', 'def"}'])
    expect(text).toBe('{"rewriteBrief":"abcdef"}')
  })

  test('falls back to accumulated text when no final assistant message exists', () => {
    const text = choosePromptText([{ type: 'message_update', delta: 'hello' }], ['hello'])
    expect(text).toBe('hello')
  })
})
