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
 *
 * **Skill Script Integration:**
 * When `skills` option is provided, the agent discovers scripts in
 * skill directories and registers them as callable tools. This enables
 * FunctionGemma to invoke user-defined skills via the standard tool
 * calling mechanism.
 */

import { useBehavioral } from '../main/use-behavioral.ts'
import type { AgentContext, AgentEvents, AgentHandlers, AgentLogger, TrajectoryMessage } from './agent.types.ts'
import { registerBaseConstraints } from './constraints.ts'
import { discoverSkillScripts, discoverSkills, formatSkillsContext, loadSkillScripts } from './skill-scripts.ts'

/** Default no-op logger */
const noopLogger: AgentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
}

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
 * See `src/agent/tests/use-world-agent.spec.ts` for usage patterns.
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
  async bProgram({ trigger, bThreads, bSync, bThread, tools, model, logger = noopLogger, skills, systemPrompt }) {
    // Register base constraint bThreads
    registerBaseConstraints(bThreads, bSync, bThread)

    // Discover and register skill scripts if configured
    let skillContext = ''
    if (skills) {
      const { skillsRoot = '.claude/skills', extensions, timeout } = skills
      const discoveredSkills = await discoverSkills(skillsRoot)
      const discoveredScripts = await discoverSkillScripts({ skillsRoot, extensions })

      // Register scripts as tools
      await loadSkillScripts(tools, { skillsRoot, extensions, timeout })

      // Generate context for system prompt
      skillContext = formatSkillsContext(discoveredScripts, discoveredSkills)
      logger.info(`Discovered ${discoveredScripts.length} skill scripts from ${discoveredSkills.length} skills`)
    }

    // Build system prompt with skill context
    const buildSystemPrompt = (): string => {
      const parts: string[] = []
      if (systemPrompt) parts.push(systemPrompt)
      if (skillContext) parts.push(skillContext)
      return parts.join('\n\n') || 'You are a UI generation agent. Generate templates using the available tools.'
    }

    // Return event handlers
    const handlers: AgentHandlers = {
      /**
       * Handle generation request from user intent.
       * Calls the model and triggers tool execution.
       */
      async generate({ intent }) {
        try {
          // Build messages with system prompt
          const messages: TrajectoryMessage[] = [
            { role: 'system', content: buildSystemPrompt() },
            { role: 'user', content: intent },
          ]

          // Call model with tools
          const response = await model.chatCompletion({
            messages,
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
          logger.error(`Generation failed: ${error instanceof Error ? error.message : String(error)}`)
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
          logger.warn(`Tool ${name} failed: ${result.error}`)
        }
      },

      /**
       * Handle story execution results.
       * Used for reward computation in training.
       */
      storyResult(result) {
        if (!result.passed) {
          logger.warn(`Story failed: ${result.errors.join(', ')}`)
        }
        if (!result.a11yPassed) {
          logger.warn('Accessibility check failed')
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
          logger.warn(`Validation failed: ${errors.join(', ')}`)
        }
      },

      /**
       * Handle code execution requests.
       * Executes sandboxed code with tool access.
       */
      executeCode({ code }) {
        // Code execution is handled by the sandbox module
        // This handler logs the event for trajectory generation
        logger.info(`Executing code: ${code.slice(0, 100)}${code.length > 100 ? '...' : ''}`)
      },

      /**
       * Handle code execution results.
       */
      codeResult({ success, error }) {
        if (!success) {
          logger.warn(`Code execution failed: ${error}`)
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
