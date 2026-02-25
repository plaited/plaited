/**
 * Shared trajectory utilities for extraction and analysis.
 *
 * @remarks
 * Provides functions for extracting trajectory data from parsed updates,
 * detecting richness levels, and checking for tool errors.
 *
 * @packageDocumentation
 */

import type { ParsedUpdate } from '../headless/headless-output-parser.ts'
import type { TrajectoryRichness, TrajectoryStep } from '../schemas.ts'
import { ToolInputSchema } from '../schemas.ts'

/**
 * Extract trajectory from parsed updates.
 *
 * @remarks
 * Converts ParsedUpdate stream into TrajectoryStep array.
 * Handles tool call deduplication (start/completion events).
 *
 * @param updates - Parsed updates from output parser
 * @param startTime - Reference time for timestamp calculation
 * @returns Array of trajectory steps with relative timestamps
 *
 * @public
 */
export const extractTrajectory = (updates: ParsedUpdate[], startTime: number): TrajectoryStep[] => {
  const trajectory: TrajectoryStep[] = []
  const toolCallMap = new Map<string, { start: number; step: TrajectoryStep & { type: 'tool_call' } }>()

  for (const update of updates) {
    const timestamp = update.timestamp - startTime

    if (update.type === 'thought') {
      trajectory.push({
        type: 'thought',
        content: update.content ?? '',
        timestamp,
      })
    } else if (update.type === 'message') {
      trajectory.push({
        type: 'message',
        content: update.content ?? '',
        timestamp,
      })
    } else if (update.type === 'tool_call') {
      const toolCallId = update.title ?? `tool_${timestamp}`
      const existing = toolCallMap.get(toolCallId)

      if (existing && update.status === 'completed') {
        // Update existing tool call with completion info
        existing.step.status = update.status
        existing.step.duration = timestamp - existing.start
        if (update.output !== undefined) {
          existing.step.output = update.output
        }
        // Remove from map so a subsequent call with the same name starts fresh
        toolCallMap.delete(toolCallId)
      } else if (!existing) {
        // New tool call
        const step: TrajectoryStep & { type: 'tool_call' } = {
          type: 'tool_call',
          name: update.title ?? 'unknown',
          status: update.status ?? 'pending',
          ...(update.input !== undefined && { input: update.input }),
          timestamp,
        }
        toolCallMap.set(toolCallId, { start: timestamp, step })
        trajectory.push(step)
      }
    } else if (update.type === 'plan') {
      trajectory.push({
        type: 'plan',
        entries: [],
        timestamp,
      })
    }
  }

  return trajectory
}

/**
 * Extract final text output from trajectory.
 *
 * @remarks
 * Concatenates all message step content to produce final output string.
 *
 * @param trajectory - Trajectory steps from capture
 * @returns Concatenated message content
 *
 * @public
 */
export const extractOutput = (trajectory: TrajectoryStep[]): string => {
  return trajectory
    .filter((step): step is TrajectoryStep & { type: 'message' } => step.type === 'message')
    .map((step) => step.content)
    .join('\n')
}

/**
 * Check if any tool calls failed in trajectory.
 *
 * @param trajectory - Trajectory steps from capture
 * @returns True if any tool call has 'failed' status
 *
 * @public
 */
export const hasToolErrors = (trajectory: TrajectoryStep[]): boolean => {
  return trajectory.some((step) => step.type === 'tool_call' && step.status === 'failed')
}

/**
 * Detect trajectory richness level from captured steps.
 *
 * @remarks
 * Different adapters provide varying levels of detail:
 * - `full`: Has thoughts, tool calls, or plans (e.g., Claude Code)
 * - `messages-only`: Only message steps present
 * - `minimal`: Empty or unknown content
 *
 * Uses single-pass iteration with early exit for efficiency.
 *
 * @param trajectory - Trajectory steps from capture
 * @returns Detected richness level
 *
 * @public
 */
export const detectTrajectoryRichness = (trajectory: TrajectoryStep[]): TrajectoryRichness => {
  let hasMessages = false

  for (const step of trajectory) {
    // Early exit: any of these means 'full' richness
    if (step.type === 'thought' || step.type === 'tool_call' || step.type === 'plan') {
      return 'full'
    }
    if (step.type === 'message') {
      hasMessages = true
    }
  }

  return hasMessages ? 'messages-only' : 'minimal'
}

/**
 * Extract file path from tool input if present.
 *
 * @param input - Tool call input object
 * @returns File path string or undefined
 *
 * @public
 */
export const extractFilePath = (input: unknown): string | undefined => {
  const result = ToolInputSchema.safeParse(input)
  if (!result.success) return undefined
  return result.data.file_path ?? result.data.path
}

/**
 * Extract content from tool input if present.
 *
 * @param input - Tool call input object
 * @returns Content string or undefined
 *
 * @public
 */
export const extractContent = (input: unknown): string | undefined => {
  const result = ToolInputSchema.safeParse(input)
  if (!result.success) return undefined
  return result.data.content ?? result.data.new_string
}
