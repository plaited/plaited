/**
 * Base behavioral constraints (bThreads) for the world agent.
 * These constraints block invalid generations before tool execution.
 *
 * @remarks
 * Constraints are implemented as bThreads that use the `block` idiom
 * to prevent invalid events from being selected. This is the key
 * mechanism that makes behavioral programming suitable for agent coordination.
 */

import type { BPEvent, BSync, BThread, BThreads, RulesFunction } from '../main/behavioral.types.ts'
import type { AgentEventTypes, ToolResult } from './agent.types.ts'

/**
 * Detects raw color values in template content.
 * Returns true if content contains hex colors, rgb(), etc.
 */
export const hasRawColors = (content: string): boolean => {
  const hexPattern = /#[0-9a-fA-F]{3,8}\b/
  const rgbPattern = /rgb\s*\(/i
  const rgbaPattern = /rgba\s*\(/i
  const hslPattern = /hsl\s*\(/i

  return hexPattern.test(content) || rgbPattern.test(content) || rgbaPattern.test(content) || hslPattern.test(content)
}

/**
 * Detects inline styles in template content.
 * Returns true if content contains style attributes.
 */
export const hasInlineStyles = (content: string): boolean => {
  return /\sstyle\s*=\s*["'{]/i.test(content)
}

/**
 * Creates a bThread that blocks template writes containing raw color values.
 * Forces the agent to use design tokens instead.
 *
 * @param bSync The bSync factory from behavioral program
 * @param bThread The bThread factory from behavioral program
 * @returns A RulesFunction that blocks invalid color usage
 */
export const createEnforceTokenUsage = (bSync: BSync, bThread: BThread): RulesFunction => {
  return bThread(
    [
      bSync({
        block: (event: BPEvent) => {
          if (event.type !== 'toolResult') return false
          const detail = event.detail as { name: string; result: ToolResult }
          if (detail.name !== 'writeTemplate') return false

          // Check if the written content has raw colors
          const content = (detail.result.data as { content?: string })?.content
          if (!content) return false

          return hasRawColors(content)
        },
      }),
    ],
    true,
  ) // Repeat indefinitely
}

/**
 * Creates a bThread that blocks story execution results with failed accessibility.
 * Prevents the agent from considering a task complete if a11y fails.
 *
 * @param bSync The bSync factory from behavioral program
 * @param bThread The bThread factory from behavioral program
 * @returns A RulesFunction that blocks on a11y failure
 */
export const createEnforceAccessibility = (bSync: BSync, bThread: BThread): RulesFunction => {
  return bThread(
    [
      bSync({
        waitFor: 'storyResult',
      }),
      bSync({
        block: (event: BPEvent) => {
          if (event.type !== 'storyResult') return false
          const detail = event.detail as AgentEventTypes['storyResult']
          return !detail.a11yPassed
        },
      }),
    ],
    true,
  ) // Repeat indefinitely
}

/**
 * Creates a bThread that coordinates the generation workflow.
 * Ensures tools are called in a logical sequence.
 *
 * @param bSync The bSync factory from behavioral program
 * @param bThread The bThread factory from behavioral program
 * @returns A RulesFunction that coordinates generation steps
 */
export const createCoordinateGeneration = (bSync: BSync, bThread: BThread): RulesFunction => {
  return bThread(
    [
      // Wait for generation request
      bSync({ waitFor: 'generate' }),
      // Wait for tool calls
      bSync({ waitFor: 'toolCall' }),
      // Wait for all tool results
      bSync({ waitFor: 'toolResult' }),
    ],
    true,
  )
}

/**
 * Registers the base constraint bThreads on a BThreads instance.
 * These are the default constraints that all world agents should use.
 *
 * @param bThreads The BThreads instance to register constraints on
 * @param bSync The bSync factory from behavioral program
 * @param bThread The bThread factory from behavioral program
 */
export const registerBaseConstraints = (bThreads: BThreads, bSync: BSync, bThread: BThread): void => {
  bThreads.set({
    enforceTokenUsage: createEnforceTokenUsage(bSync, bThread),
    enforceAccessibility: createEnforceAccessibility(bSync, bThread),
    coordinateGeneration: createCoordinateGeneration(bSync, bThread),
  })
}
