/**
 * Internal utilities for ACP content manipulation.
 *
 * @remarks
 * Low-level functions for building content blocks and extracting data
 * from session responses. These are used internally by the higher-level
 * helpers in acp-helpers.ts.
 *
 * @internal
 */

import type {
  BlobResourceContents,
  ContentBlock,
  PlanEntry,
  SessionNotification,
  SessionUpdate,
  TextContent,
  TextResourceContents,
  ToolCall,
  ToolCallContent,
} from '@agentclientprotocol/sdk'

// ============================================================================
// Content Block Builders
// ============================================================================

/**
 * Creates a text content block.
 *
 * @param text - The text content
 * @returns Text content block
 */
export const createTextContent = (text: string): ContentBlock => ({
  type: 'text',
  text,
})

/**
 * Creates an image content block from base64 data.
 *
 * @param data - Base64-encoded image data
 * @param mimeType - MIME type (e.g., 'image/png', 'image/jpeg')
 * @returns Image content block
 */
export const createImageContent = (data: string, mimeType: string): ContentBlock => ({
  type: 'image',
  data,
  mimeType,
})

/**
 * Creates an audio content block from base64 data.
 *
 * @param data - Base64-encoded audio data
 * @param mimeType - MIME type (e.g., 'audio/wav', 'audio/mp3')
 * @returns Audio content block
 */
export const createAudioContent = (data: string, mimeType: string): ContentBlock => ({
  type: 'audio',
  data,
  mimeType,
})

/** Parameters for creating a resource link */
export type CreateResourceLinkParams = {
  /** URI to the resource */
  uri: string
  /** Resource name (required by SDK) */
  name: string
  /** Optional MIME type */
  mimeType?: string
}

/**
 * Creates a resource link content block.
 *
 * @param params - Resource link parameters
 * @returns Resource link content block
 */
export const createResourceLink = ({ uri, name, mimeType }: CreateResourceLinkParams): ContentBlock => ({
  type: 'resource_link',
  uri,
  name,
  ...(mimeType && { mimeType }),
})

/** Parameters for creating an embedded text resource */
export type CreateTextResourceParams = {
  /** URI identifying the resource */
  uri: string
  /** Text content of the resource */
  text: string
  /** Optional MIME type */
  mimeType?: string
}

/**
 * Creates an embedded text resource content block.
 *
 * @param params - Text resource parameters
 * @returns Resource content block
 */
export const createTextResource = ({ uri, text, mimeType }: CreateTextResourceParams): ContentBlock => ({
  type: 'resource',
  resource: {
    uri,
    text,
    ...(mimeType && { mimeType }),
  } as TextResourceContents,
})

/** Parameters for creating an embedded blob resource */
export type CreateBlobResourceParams = {
  /** URI identifying the resource */
  uri: string
  /** Base64-encoded binary data */
  blob: string
  /** Optional MIME type */
  mimeType?: string
}

/**
 * Creates an embedded blob resource content block.
 *
 * @param params - Blob resource parameters
 * @returns Resource content block
 */
export const createBlobResource = ({ uri, blob, mimeType }: CreateBlobResourceParams): ContentBlock => ({
  type: 'resource',
  resource: {
    uri,
    blob,
    ...(mimeType && { mimeType }),
  } as BlobResourceContents,
})

// ============================================================================
// Content Extraction
// ============================================================================

/**
 * Extracts all text from content blocks.
 *
 * @param content - Array of content blocks
 * @returns Concatenated text content
 */
export const extractText = (content: ContentBlock[]): string => {
  return content
    .filter((block): block is TextContent & { type: 'text' } => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

/**
 * Helper to extract content from SessionUpdate (discriminated union)
 */
const getUpdateContent = (update: SessionUpdate): ContentBlock | undefined => {
  if (
    update.sessionUpdate === 'user_message_chunk' ||
    update.sessionUpdate === 'agent_message_chunk' ||
    update.sessionUpdate === 'agent_thought_chunk'
  ) {
    return update.content
  }
  return undefined
}

/**
 * Helper to extract tool call from SessionUpdate
 */
const getUpdateToolCall = (update: SessionUpdate): ToolCall | undefined => {
  if (update.sessionUpdate === 'tool_call') {
    return update
  }
  return undefined
}

/**
 * Helper to extract plan from SessionUpdate
 */
const getUpdatePlan = (update: SessionUpdate): PlanEntry[] | undefined => {
  if (update.sessionUpdate === 'plan') {
    return update.entries
  }
  return undefined
}

/**
 * Extracts text from session notifications.
 *
 * @remarks
 * Streaming produces partial tokens that should be concatenated directly.
 * Uses empty string join to preserve the original text structure.
 *
 * @param notifications - Array of session notifications
 * @returns Concatenated text from all updates
 */
export const extractTextFromUpdates = (notifications: SessionNotification[]): string => {
  const texts: string[] = []
  for (const notification of notifications) {
    const content = getUpdateContent(notification.update)
    if (content && content.type === 'text') {
      texts.push(content.text)
    }
  }
  // Join without separator - streaming chunks should be concatenated directly
  return texts.join('')
}

/**
 * Extracts all tool calls from session notifications.
 *
 * @param notifications - Array of session notifications
 * @returns Array of all tool calls
 */
export const extractToolCalls = (notifications: SessionNotification[]): ToolCall[] => {
  const calls: ToolCall[] = []
  for (const notification of notifications) {
    const toolCall = getUpdateToolCall(notification.update)
    if (toolCall) {
      calls.push(toolCall)
    }
  }
  return calls
}

/**
 * Extracts the latest state of each tool call (deduplicated by toolCallId).
 *
 * @param notifications - Array of session notifications
 * @returns Map of tool call ID to latest tool call state
 */
export const extractLatestToolCalls = (notifications: SessionNotification[]): Map<string, ToolCall> => {
  const latest = new Map<string, ToolCall>()
  for (const notification of notifications) {
    const toolCall = getUpdateToolCall(notification.update)
    if (toolCall) {
      latest.set(toolCall.toolCallId, toolCall)
    }
  }
  return latest
}

/**
 * Extracts the latest plan from session notifications.
 *
 * @param notifications - Array of session notifications
 * @returns Latest plan entries or undefined if no plan
 */
export const extractPlan = (notifications: SessionNotification[]): PlanEntry[] | undefined => {
  // Plans are replaced entirely, so find the last one
  for (let i = notifications.length - 1; i >= 0; i--) {
    const notification = notifications[i]
    if (notification) {
      const plan = getUpdatePlan(notification.update)
      if (plan) {
        return plan
      }
    }
  }
  return undefined
}

// ============================================================================
// Tool Call Utilities
// ============================================================================

/**
 * Filters tool calls by status.
 *
 * @param toolCalls - Array of tool calls
 * @param status - Status to filter by
 * @returns Filtered tool calls
 */
export const filterToolCallsByStatus = (toolCalls: ToolCall[], status: ToolCall['status']): ToolCall[] => {
  return toolCalls.filter((call) => call.status === status)
}

/**
 * Filters tool calls by title.
 *
 * @param toolCalls - Array of tool calls
 * @param title - Tool title to filter by
 * @returns Filtered tool calls
 */
export const filterToolCallsByTitle = (toolCalls: ToolCall[], title: string): ToolCall[] => {
  return toolCalls.filter((call) => call.title === title)
}

/**
 * Checks if any tool calls have failed.
 *
 * @param toolCalls - Array of tool calls
 * @returns True if any tool call has 'failed' status
 */
export const hasToolCallErrors = (toolCalls: ToolCall[]): boolean => {
  return toolCalls.some((call) => call.status === 'failed')
}

/**
 * Gets completed tool calls with their output content.
 *
 * @param toolCalls - Array of tool calls
 * @returns Tool calls that completed with content
 */
export const getCompletedToolCallsWithContent = (
  toolCalls: ToolCall[],
): Array<ToolCall & { content: ToolCallContent[] }> => {
  return toolCalls.filter(
    (call): call is ToolCall & { content: ToolCallContent[] } =>
      call.status === 'completed' && call.content !== undefined && call.content.length > 0,
  )
}

// ============================================================================
// Plan Utilities
// ============================================================================

/**
 * Gets plan entries by status.
 *
 * @param plan - Array of plan entries
 * @param status - Status to filter by
 * @returns Filtered plan entries
 */
export const filterPlanByStatus = (plan: PlanEntry[], status: PlanEntry['status']): PlanEntry[] => {
  return plan.filter((entry) => entry.status === status)
}

/**
 * Calculates plan completion percentage.
 *
 * @param plan - Array of plan entries
 * @returns Percentage of completed entries (0-100)
 */
export const getPlanProgress = (plan: PlanEntry[]): number => {
  if (plan.length === 0) return 100
  const completed = plan.filter((entry) => entry.status === 'completed').length
  return Math.round((completed / plan.length) * 100)
}
