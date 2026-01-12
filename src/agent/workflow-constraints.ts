/**
 * Workflow orchestration bThreads for the world agent.
 *
 * @remarks
 * These bThreads coordinate workflow sequencing, NOT content validation.
 * Content validation happens via tiered analysis (static → model → browser).
 *
 * Agent bThreads ensure:
 * - Proper workflow order (generate → validate → execute → feedback)
 * - Context budget enforcement
 * - Concurrent generation limits
 */

import type { BPEvent, BSync, BThread, BThreads, RulesFunction } from '../main/behavioral.types.ts'
import type { StaticAnalysisResult, ToolSchema } from './agent.types.ts'
import type { ContextBudget } from './context-budget.ts'
import { estimateToolTokens } from './context-budget.ts'

// ============================================================================
// Event Detail Types
// ============================================================================

type ToolCallDetail = {
  calls: Array<{ name: string; schema?: ToolSchema }>
}

type StaticAnalysisDetail = StaticAnalysisResult

// ============================================================================
// Workflow Sequence Constraints
// ============================================================================

/**
 * Creates a bThread that enforces workflow sequence.
 *
 * @remarks
 * Ensures proper order: generate → staticAnalysis → [optional judge] → execute → feedback
 * Blocks code execution before validation passes.
 *
 * @param bSync - The bSync factory
 * @param bThread - The bThread factory
 * @returns A RulesFunction enforcing workflow sequence
 */
export const createEnforceWorkflowSequence = (bSync: BSync, bThread: BThread): RulesFunction => {
  return bThread(
    [
      // Wait for generation request
      bSync({ waitFor: 'generate' }),
      // Block code execution until static analysis is received
      bSync({
        waitFor: 'staticAnalysis',
        block: 'executeCode',
      }),
      // Check if static analysis passed or failed
      bSync({
        waitFor: (event: BPEvent) => {
          if (event.type !== 'staticAnalysis') return false
          const detail = event.detail as StaticAnalysisDetail
          return detail.passed
        },
        interrupt: (event: BPEvent) => {
          // Abort workflow if static analysis fails
          if (event.type !== 'staticAnalysis') return false
          const detail = event.detail as StaticAnalysisDetail
          return !detail.passed
        },
      }),
      // Allow code execution after validation passes
      bSync({ waitFor: 'executeCode' }),
    ],
    true, // Repeat for each generation cycle
  )
}

/**
 * Creates a bThread that enforces context budget.
 *
 * @remarks
 * Blocks tool calls that would exceed the available token budget.
 * This prevents context window overflow for smaller models.
 *
 * @param bSync - The bSync factory
 * @param bThread - The bThread factory
 * @param contextBudget - The budget manager instance
 * @returns A RulesFunction enforcing budget constraints
 */
export const createEnforceContextBudget = (
  bSync: BSync,
  bThread: BThread,
  contextBudget: ContextBudget,
): RulesFunction => {
  return bThread(
    [
      bSync({
        block: (event: BPEvent) => {
          if (event.type !== 'toolCall') return false
          const detail = event.detail as ToolCallDetail

          // Calculate total tokens for all tool calls
          let totalTokens = 0
          for (const call of detail.calls) {
            if (call.schema) {
              totalTokens += estimateToolTokens(call.schema)
            }
          }

          // Block if would exceed budget
          return !contextBudget.canFit(totalTokens, 'tools')
        },
      }),
    ],
    true,
  )
}

/**
 * Creates a bThread that limits concurrent generation.
 *
 * @remarks
 * Prevents runaway generation loops by ensuring only one
 * generation is in progress at a time.
 *
 * @param bSync - The bSync factory
 * @param bThread - The bThread factory
 * @returns A RulesFunction limiting concurrent generation
 */
export const createLimitConcurrentGeneration = (bSync: BSync, bThread: BThread): RulesFunction => {
  return bThread(
    [
      // Wait for a generation to start
      bSync({ waitFor: 'generate' }),
      // Block new generations until current one completes
      bSync({
        waitFor: (event: BPEvent) => {
          // Allow completion events to pass
          return event.type === 'generationComplete' || event.type === 'error' || event.type === 'cancel'
        },
        block: (event: BPEvent) => {
          // Block new generation requests
          return event.type === 'generate'
        },
      }),
    ],
    true,
  )
}

/**
 * Creates a bThread that coordinates tool chaining.
 *
 * @remarks
 * Ensures that when tools are chained sequentially,
 * each tool completes before the next starts.
 *
 * @param bSync - The bSync factory
 * @param bThread - The bThread factory
 * @returns A RulesFunction coordinating tool chains
 */
export const createCoordinateToolChain = (bSync: BSync, bThread: BThread): RulesFunction => {
  return bThread(
    [
      // Wait for a chain request
      bSync({
        waitFor: (event: BPEvent) =>
          event.type === 'chainTools' && (event.detail as { sequential?: boolean })?.sequential === true,
      }),
      // For sequential chains, ensure one tool completes before next starts
      bSync({
        waitFor: 'toolResult',
        block: 'toolCall',
      }),
    ],
    true,
  )
}

/**
 * Creates a bThread that enforces tiered analysis sequence.
 *
 * @remarks
 * Ensures Tier 1 (static) must pass before Tier 2 (judge) runs,
 * and Tier 2 must pass before Tier 3 (browser) executes.
 *
 * @param bSync - The bSync factory
 * @param bThread - The bThread factory
 * @param options - Configuration options
 * @returns A RulesFunction enforcing tiered analysis
 */
export const createEnforceTieredAnalysis = (
  bSync: BSync,
  bThread: BThread,
  options: { skipTier2?: boolean } = {},
): RulesFunction => {
  const syncs: RulesFunction[] = []

  // Wait for static analysis
  syncs.push(
    bSync({
      waitFor: 'staticAnalysis',
      block: (event: BPEvent) => event.type === 'modelJudge' || event.type === 'browserTest',
    }),
  )

  // Block until static passes
  syncs.push(
    bSync({
      waitFor: (event: BPEvent) => {
        if (event.type !== 'staticAnalysis') return false
        return (event.detail as StaticAnalysisDetail).passed
      },
      interrupt: (event: BPEvent) => {
        if (event.type !== 'staticAnalysis') return false
        return !(event.detail as StaticAnalysisDetail).passed
      },
    }),
  )

  if (!options.skipTier2) {
    // Wait for judge evaluation
    syncs.push(
      bSync({
        waitFor: 'modelJudge',
        block: 'browserTest',
      }),
    )

    // Block until judge passes
    syncs.push(
      bSync({
        waitFor: (event: BPEvent) => {
          if (event.type !== 'modelJudge') return false
          return (event.detail as { passed: boolean }).passed
        },
        interrupt: (event: BPEvent) => {
          if (event.type !== 'modelJudge') return false
          return !(event.detail as { passed: boolean }).passed
        },
      }),
    )
  }

  // Allow browser test after analysis passes
  syncs.push(bSync({ waitFor: 'browserTest' }))

  return bThread(syncs, true)
}

// ============================================================================
// Registration Helper
// ============================================================================

/**
 * Registers workflow constraint bThreads on a BThreads instance.
 *
 * @param bThreads - The BThreads instance to register constraints on
 * @param bSync - The bSync factory
 * @param bThread - The bThread factory
 * @param options - Registration options
 */
export const registerWorkflowConstraints = (
  bThreads: BThreads,
  bSync: BSync,
  bThread: BThread,
  options: {
    contextBudget?: ContextBudget
    skipTier2?: boolean
  } = {},
): void => {
  const constraints: Record<string, RulesFunction> = {
    enforceWorkflowSequence: createEnforceWorkflowSequence(bSync, bThread),
    limitConcurrentGeneration: createLimitConcurrentGeneration(bSync, bThread),
    coordinateToolChain: createCoordinateToolChain(bSync, bThread),
    enforceTieredAnalysis: createEnforceTieredAnalysis(bSync, bThread, { skipTier2: options.skipTier2 }),
  }

  // Add budget enforcement if budget manager provided
  if (options.contextBudget) {
    constraints.enforceContextBudget = createEnforceContextBudget(bSync, bThread, options.contextBudget)
  }

  bThreads.set(constraints)
}
