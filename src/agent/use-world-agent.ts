/**
 * World agent factory using useBehavioral pattern.
 * The agent loop IS a bProgram - NOT a class.
 *
 * @remarks
 * This factory creates behavioral programs that coordinate
 * tool execution with runtime constraints. The key difference
 * from class-based agents (like HuggingFace tiny-agents) is that
 * bThreads act as runtime constraints that block invalid generations
 * BEFORE execution, not after.
 */

import { useBehavioral } from '../main/use-behavioral.ts'
import type { AgentContext, AgentEvents, AgentHandlers } from './agent.types.ts'
import { registerBaseConstraints } from './constraints.ts'

/**
 * Creates a world agent behavioral program factory.
 *
 * @returns An async initialization function that creates configured agent instance
 *
 * @remarks
 * **Key Architectural Points:**
 * - The agent IS a bProgram, not a wrapper around one
 * - bThreads block invalid generations before tool execution
 * - Coordination happens through event selection, not explicit state
 * - Inspector snapshots provide training data observability
 *
 * **Event Flow:**
 * 1. `generate` - User intent triggers generation
 * 2. Model inference produces `toolCall` events
 * 3. Tools execute, producing `toolResult` events
 * 4. Constraint bThreads may block invalid results
 * 5. `storyResult` provides validation feedback
 *
 * @example
 * ```typescript
 * const initAgent = useWorldAgent()
 *
 * const trigger = await initAgent({
 *   tools: createCoreTools({ outputDir: './generated' }),
 *   model: new InferenceClient(process.env.HF_TOKEN)
 * })
 *
 * trigger({ type: 'generate', detail: { intent: 'Create a button' } })
 * ```
 */
export const useWorldAgent = useBehavioral<AgentEvents, AgentContext>({
  /**
   * Public events that can be triggered externally.
   * Internal coordination events (toolCall, toolResult) are not exposed.
   */
  publicEvents: ['generate', 'storyResult'],

  /**
   * The behavioral program that coordinates agent execution.
   * Returns event handlers that respond to selected events.
   */
  async bProgram({ trigger, bThreads, bSync, bThread, tools, model }) {
    // Register base constraint bThreads
    registerBaseConstraints(bThreads, bSync, bThread)

    // Return event handlers
    const handlers: AgentHandlers = {
      /**
       * Handle generation request from user intent.
       * Calls the model and triggers tool execution.
       */
      async generate({ intent }) {
        try {
          // Call model with tools
          const response = await model.chatCompletion({
            messages: [{ role: 'user', content: intent }],
            tools: tools.schemas,
          })

          // Trigger tool calls if any
          if (response.tool_calls && response.tool_calls.length > 0) {
            trigger({
              type: 'toolCall',
              detail: { calls: response.tool_calls },
            })
          }
        } catch (error) {
          console.error('Generation failed:', error)
        }
      },

      /**
       * Handle tool calls from model response.
       * Executes each tool and triggers result events.
       */
      async toolCall({ calls }) {
        for (const call of calls) {
          const result = await tools.execute(call)
          trigger({
            type: 'toolResult',
            detail: { name: call.name, result },
          })
        }
      },

      /**
       * Handle tool execution results.
       * Logged for trajectory generation.
       */
      toolResult({ name, result }) {
        if (!result.success) {
          console.warn(`Tool ${name} failed:`, result.error)
        }
      },

      /**
       * Handle story execution results.
       * Used for reward computation in training.
       */
      storyResult(result) {
        if (!result.passed) {
          console.warn('Story failed:', result.errors)
        }
        if (!result.a11yPassed) {
          console.warn('Accessibility check failed')
        }
      },

      /**
       * Handle validation requests.
       */
      validate({ content }) {
        // Validation logic - could check patterns, syntax, etc.
        const valid = content.length > 0
        trigger({
          type: 'validated',
          detail: { valid, errors: valid ? [] : ['Empty content'] },
        })
      },

      /**
       * Handle validation results.
       */
      validated({ valid, errors }) {
        if (!valid) {
          console.warn('Validation failed:', errors)
        }
      },
    }

    return handlers
  },
})

/**
 * Type for the initialized world agent trigger function.
 */
export type WorldAgentTrigger = Awaited<ReturnType<typeof useWorldAgent>>
