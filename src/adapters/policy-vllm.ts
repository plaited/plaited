import * as z from 'zod'

import type { BPEvent } from '../behavioral/behavioral.schemas.ts'
import {
  AdapterToolExecutionEventSchema,
  type AdapterToolResultEvent,
  AdapterToolResultEventSchema,
} from './adapters.schemas.ts'

export const VllmPolicyMessageSchema = z
  .object({
    role: z.enum(['system', 'user', 'assistant', 'tool']),
    content: z.string().min(1),
    tool_call_id: z.string().min(1).optional(),
    name: z.string().min(1).optional(),
  })
  .strict()
  .describe('Replay-safe chat message entry for vLLM offline adapter inputs.')

export type VllmPolicyMessage = z.output<typeof VllmPolicyMessageSchema>

type FormatEventAsUserMessage = ({ event }: { event: BPEvent }) => string

export type MapBPEventsToVllmMessagesArgs = {
  events: BPEvent[]
  systemPrompt?: string
  promptEventTypes?: string[]
  includeUnmappedAsUser?: boolean
  formatEventAsUserMessage?: FormatEventAsUserMessage
}

const DEFAULT_PROMPT_EVENT_TYPES = ['task']

const canonicalizeJsonValue = (value: unknown): unknown => {
  if (value === null) {
    return null
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizeJsonValue(item))
  }
  if (typeof value !== 'object') {
    return value
  }

  const record = value as Record<string, unknown>
  return Object.keys(record)
    .sort((a, b) => a.localeCompare(b))
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = canonicalizeJsonValue(record[key])
      return acc
    }, {})
}

const stableStringify = (value: unknown): string => {
  return JSON.stringify(canonicalizeJsonValue(value))
}

const defaultFormatEventAsUserMessage: FormatEventAsUserMessage = ({ event }) => {
  if (event.detail === undefined) {
    return event.type
  }
  return `${event.type}: ${stableStringify(event.detail)}`
}

const toToolResultContent = ({ event }: { event: AdapterToolResultEvent }): string => {
  if (event.detail.ok) {
    return stableStringify(event.detail.result ?? {})
  }
  return stableStringify({
    error: event.detail.error ?? 'unknown tool failure',
  })
}

const createUserMessage = ({ content }: { content: string }): VllmPolicyMessage => ({
  role: 'user',
  content,
})

const createToolExecutionAssistantMessage = ({
  detail,
}: {
  detail: z.output<typeof AdapterToolExecutionEventSchema>['detail']
}): VllmPolicyMessage => ({
  role: 'assistant',
  content: stableStringify({
    type: 'tool_execution',
    taskId: detail.taskId,
    runtime: detail.runtime,
    toolCallId: detail.toolCallId,
    toolName: detail.toolName,
    arguments: detail.arguments,
  }),
})

const createToolResultMessage = ({ event }: { event: AdapterToolResultEvent }): VllmPolicyMessage => ({
  role: 'tool',
  content: toToolResultContent({ event }),
  tool_call_id: event.detail.toolCallId,
  name: event.detail.toolName,
})

export const mapBPEventsToVllmMessages = ({
  events,
  systemPrompt,
  promptEventTypes = DEFAULT_PROMPT_EVENT_TYPES,
  includeUnmappedAsUser = false,
  formatEventAsUserMessage = defaultFormatEventAsUserMessage,
}: MapBPEventsToVllmMessagesArgs): VllmPolicyMessage[] => {
  const messages: VllmPolicyMessage[] = []

  if (systemPrompt && systemPrompt.length > 0) {
    messages.push({
      role: 'system',
      content: systemPrompt,
    })
  }

  for (const event of events) {
    const toolExecution = AdapterToolExecutionEventSchema.safeParse(event)
    if (toolExecution.success) {
      messages.push(createToolExecutionAssistantMessage({ detail: toolExecution.data.detail }))
      continue
    }

    const toolResult = AdapterToolResultEventSchema.safeParse(event)
    if (toolResult.success) {
      messages.push(createToolResultMessage({ event: toolResult.data }))
      continue
    }

    if (promptEventTypes.includes(event.type)) {
      messages.push(createUserMessage({ content: formatEventAsUserMessage({ event }) }))
      continue
    }

    if (includeUnmappedAsUser) {
      messages.push(createUserMessage({ content: formatEventAsUserMessage({ event }) }))
    }
  }

  return messages.map((message) => VllmPolicyMessageSchema.parse(message))
}
