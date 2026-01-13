/**
 * High-level helper utilities for ACP prompt building and response analysis.
 *
 * @remarks
 * Provides convenience functions for common ACP workflows:
 * - Building prompts with text, files, and images
 * - Summarizing agent responses for evaluation
 *
 * For low-level content manipulation, see internal utilities in acp-utils.ts.
 */

import type { ContentBlock, PlanEntry, SessionNotification, ToolCall } from '@agentclientprotocol/sdk'
import {
  createImageContent,
  createTextContent,
  createTextResource,
  extractLatestToolCalls,
  extractPlan,
  extractTextFromUpdates,
  filterToolCallsByStatus,
  getPlanProgress,
  hasToolCallErrors,
} from './acp-utils.ts'

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
    blocks.push(createTextResource({ uri: `file://${file.path}`, text: file.content, mimeType: 'text/plain' }))
  }

  return blocks
}

/** Parameters for creating a prompt with image */
export type CreatePromptWithImageParams = {
  /** The prompt text */
  text: string
  /** Base64-encoded image data */
  imageData: string
  /** Image MIME type */
  mimeType: string
}

/**
 * Creates a prompt with text and image.
 *
 * @param params - Prompt with image parameters
 * @returns Array of content blocks
 */
export const createPromptWithImage = ({ text, imageData, mimeType }: CreatePromptWithImageParams): ContentBlock[] => {
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
  /** Tool calls that failed */
  failedToolCalls: ToolCall[]
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
 * @param notifications - Session notifications from the prompt
 * @returns Response summary
 */
export const summarizeResponse = (notifications: SessionNotification[]): PromptResponseSummary => {
  const text = extractTextFromUpdates(notifications)
  const toolCalls = [...extractLatestToolCalls(notifications).values()]
  const plan = extractPlan(notifications)

  return {
    text,
    toolCallCount: toolCalls.length,
    completedToolCalls: filterToolCallsByStatus(toolCalls, 'completed'),
    failedToolCalls: filterToolCallsByStatus(toolCalls, 'failed'),
    plan,
    planProgress: plan ? getPlanProgress(plan) : undefined,
    hasErrors: hasToolCallErrors(toolCalls),
  }
}
