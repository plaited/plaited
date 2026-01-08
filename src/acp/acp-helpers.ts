/**
 * Helper utilities for ACP content manipulation.
 *
 * @remarks
 * Provides convenience functions for:
 * - Building content blocks for prompts
 * - Extracting text and tool calls from updates
 * - Filtering and analyzing session responses
 */

import type {
  AudioContent,
  BlobResource,
  ContentBlock,
  ImageContent,
  PlanEntry,
  ResourceContent,
  ResourceLinkContent,
  SessionUpdateParams,
  TextContent,
  TextResource,
  ToolCall,
} from './acp.types.ts'

// ============================================================================
// Content Block Builders
// ============================================================================

/**
 * Creates a text content block.
 *
 * @param text - The text content
 * @returns Text content block
 */
export const createTextContent = (text: string): TextContent => ({
  type: 'text',
  text,
})

/**
 * Creates an image content block from base64 data.
 *
 * @param data - Base64-encoded image data
 * @param mimeType - MIME type (e.g., 'image/png', 'image/jpeg')
 * @param uri - Optional URI reference
 * @returns Image content block
 */
export const createImageContent = (data: string, mimeType: string, uri?: string): ImageContent => ({
  type: 'image',
  data,
  mimeType,
  ...(uri && { uri }),
})

/**
 * Creates an audio content block from base64 data.
 *
 * @param data - Base64-encoded audio data
 * @param mimeType - MIME type (e.g., 'audio/wav', 'audio/mp3')
 * @returns Audio content block
 */
export const createAudioContent = (data: string, mimeType: string): AudioContent => ({
  type: 'audio',
  data,
  mimeType,
})

/**
 * Creates a resource link content block.
 *
 * @param uri - URI to the resource
 * @param mimeType - Optional MIME type
 * @returns Resource link content block
 */
export const createResourceLink = (uri: string, mimeType?: string): ResourceLinkContent => ({
  type: 'resource_link',
  uri,
  ...(mimeType && { mimeType }),
})

/**
 * Creates an embedded text resource content block.
 *
 * @param uri - URI identifying the resource
 * @param text - Text content of the resource
 * @param mimeType - Optional MIME type
 * @returns Resource content block
 */
export const createTextResource = (uri: string, text: string, mimeType?: string): ResourceContent => ({
  type: 'resource',
  resource: {
    uri,
    text,
    ...(mimeType && { mimeType }),
  } as TextResource,
})

/**
 * Creates an embedded blob resource content block.
 *
 * @param uri - URI identifying the resource
 * @param blob - Base64-encoded binary data
 * @param mimeType - Optional MIME type
 * @returns Resource content block
 */
export const createBlobResource = (uri: string, blob: string, mimeType?: string): ResourceContent => ({
  type: 'resource',
  resource: {
    uri,
    blob,
    ...(mimeType && { mimeType }),
  } as BlobResource,
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
    .filter((block): block is TextContent => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
}

/**
 * Extracts text from session updates.
 *
 * @param updates - Array of session update parameters
 * @returns Concatenated text from all updates
 */
export const extractTextFromUpdates = (updates: SessionUpdateParams[]): string => {
  return updates
    .filter((update) => update.content)
    .map((update) => extractText(update.content!))
    .filter(Boolean)
    .join('\n')
}

/**
 * Extracts all tool calls from session updates.
 *
 * @param updates - Array of session update parameters
 * @returns Array of all tool calls
 */
export const extractToolCalls = (updates: SessionUpdateParams[]): ToolCall[] => {
  const calls: ToolCall[] = []
  for (const update of updates) {
    if (update.toolCalls) {
      calls.push(...update.toolCalls)
    }
  }
  return calls
}

/**
 * Extracts the latest state of each tool call (deduplicated by ID).
 *
 * @param updates - Array of session update parameters
 * @returns Map of tool call ID to latest tool call state
 */
export const extractLatestToolCalls = (updates: SessionUpdateParams[]): Map<string, ToolCall> => {
  const latest = new Map<string, ToolCall>()
  for (const update of updates) {
    if (update.toolCalls) {
      for (const call of update.toolCalls) {
        latest.set(call.id, call)
      }
    }
  }
  return latest
}

/**
 * Extracts the latest plan from session updates.
 *
 * @param updates - Array of session update parameters
 * @returns Latest plan entries or undefined if no plan
 */
export const extractPlan = (updates: SessionUpdateParams[]): PlanEntry[] | undefined => {
  // Plans are replaced entirely, so find the last one
  for (let i = updates.length - 1; i >= 0; i--) {
    const update = updates[i]
    if (update?.plan) {
      return update.plan
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
 * Filters tool calls by name.
 *
 * @param toolCalls - Array of tool calls
 * @param name - Tool name to filter by
 * @returns Filtered tool calls
 */
export const filterToolCallsByName = (toolCalls: ToolCall[], name: string): ToolCall[] => {
  return toolCalls.filter((call) => call.name === name)
}

/**
 * Checks if any tool calls have errors.
 *
 * @param toolCalls - Array of tool calls
 * @returns True if any tool call has error status
 */
export const hasToolCallErrors = (toolCalls: ToolCall[]): boolean => {
  return toolCalls.some((call) => call.status === 'error')
}

/**
 * Gets completed tool calls with their output content.
 *
 * @param toolCalls - Array of tool calls
 * @returns Tool calls that completed with content
 */
export const getCompletedToolCallsWithContent = (
  toolCalls: ToolCall[],
): Array<ToolCall & { content: ContentBlock[] }> => {
  return toolCalls.filter(
    (call): call is ToolCall & { content: ContentBlock[] } =>
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

// ============================================================================
// Prompt Building Utilities
// ============================================================================

/**
 * Creates a simple text prompt.
 *
 * @param text - The prompt text
 * @returns Array with single text content block
 */
export const createPrompt = (text: string): ContentBlock[] => {
  return [createTextContent(text)]
}

/**
 * Creates a prompt with text and file context.
 *
 * @param text - The prompt text
 * @param files - Array of file paths and contents to include
 * @returns Array of content blocks
 */
export const createPromptWithFiles = (
  text: string,
  files: Array<{ path: string; content: string }>,
): ContentBlock[] => {
  const blocks: ContentBlock[] = [createTextContent(text)]

  for (const file of files) {
    blocks.push(createTextResource(`file://${file.path}`, file.content, 'text/plain'))
  }

  return blocks
}

/**
 * Creates a prompt with text and image.
 *
 * @param text - The prompt text
 * @param imageData - Base64-encoded image data
 * @param mimeType - Image MIME type
 * @returns Array of content blocks
 */
export const createPromptWithImage = (text: string, imageData: string, mimeType: string): ContentBlock[] => {
  return [createTextContent(text), createImageContent(imageData, mimeType)]
}

// ============================================================================
// Response Analysis Utilities
// ============================================================================

/** Summary of a prompt response for evaluation */
export type PromptResponseSummary = {
  /** Concatenated text output */
  text: string
  /** Number of tool calls made */
  toolCallCount: number
  /** Tool calls that completed */
  completedToolCalls: ToolCall[]
  /** Tool calls that errored */
  erroredToolCalls: ToolCall[]
  /** Final plan state */
  plan?: PlanEntry[]
  /** Plan completion percentage */
  planProgress?: number
  /** Whether any errors occurred */
  hasErrors: boolean
}

/**
 * Creates a summary of a prompt response for evaluation.
 *
 * @param updates - Session updates from the prompt
 * @returns Response summary
 */
export const summarizeResponse = (updates: SessionUpdateParams[]): PromptResponseSummary => {
  const text = extractTextFromUpdates(updates)
  const toolCalls = [...extractLatestToolCalls(updates).values()]
  const plan = extractPlan(updates)

  return {
    text,
    toolCallCount: toolCalls.length,
    completedToolCalls: filterToolCallsByStatus(toolCalls, 'completed'),
    erroredToolCalls: filterToolCallsByStatus(toolCalls, 'error'),
    plan,
    planProgress: plan ? getPlanProgress(plan) : undefined,
    hasErrors: hasToolCallErrors(toolCalls),
  }
}
