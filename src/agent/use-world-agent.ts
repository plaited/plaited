/**
 * World agent factory using useBehavioral.
 *
 * @remarks
 * Protocol-agnostic agent that communicates via signals.
 * Implements the neuro-symbolic architecture:
 * - Neural policy (inference model) proposes tool calls
 * - Symbolic constraints (bThreads) block invalid actions
 * - Tiered analysis validates before execution
 *
 * Extensibility:
 * - Custom handlers can override defaults
 * - Custom bThreads add constraints
 * - User preferences enable hybrid UI
 */

import type { Handlers, Signal } from '../main/behavioral.types.ts'
import { useSignal } from '../main/use-signal.ts'
import { useBehavioral } from '../main.ts'
import type {
  AgentOutEvent,
  FunctionCall,
  InferenceModel,
  SandboxConfig,
  StoryResult,
  ToolRegistry,
  ToolResult,
  ToolSource,
  UserPreferenceProfile,
  WorldAgentConfig,
} from './agent.types.ts'
import { type CodeExecutor, createCodeExecutor } from './code-executor.ts'
import { type ContextBudget, createContextBudget } from './context-budget.ts'
import { createPreferenceConstraint } from './preference-constraints.ts'
import { runStaticAnalysis, type StaticAnalysisOptions } from './static-analysis.ts'
import { registerWorkflowConstraints } from './workflow-constraints.ts'

// ============================================================================
// Event Types
// ============================================================================

/**
 * World agent event types for the behavioral program.
 */
type WorldAgentEvents = {
  // Inbound events (public trigger)
  generate: { intent: string; context?: unknown }
  cancel: undefined
  feedback: { result: StoryResult }
  disconnect: undefined
  executeCode: { code: string; sandbox?: SandboxConfig }
  chainTools: { calls: FunctionCall[]; sequential?: boolean }
  resolveTool: { name: string; source?: ToolSource }

  // Internal events (for bThread coordination)
  staticAnalysis: { passed: boolean; tier: 1; checks: unknown[] }
  modelJudge: { passed: boolean; score: number; reasoning: string }
  generationComplete: undefined
  toolCall: { calls: FunctionCall[] }
  toolResult: { name: string; result: ToolResult }
  browserTest: { result: StoryResult }
  error: { error: Error }
}

/**
 * Context provided to the behavioral program.
 */
type WorldAgentContext = {
  outbound: Signal<AgentOutEvent>
  tools: ToolRegistry
  model: InferenceModel
  contextBudget: ContextBudget
  codeExecutor: CodeExecutor
  preferences?: UserPreferenceProfile
  constraints?: WorldAgentConfig['constraints']
}

// ============================================================================
// Public Events
// ============================================================================

const PUBLIC_EVENTS = [
  'generate',
  'cancel',
  'feedback',
  'disconnect',
  'executeCode',
  'chainTools',
  'resolveTool',
] as const

// ============================================================================
// World Agent Factory
// ============================================================================

/**
 * Creates a world agent behavioral program factory.
 *
 * @param config - Agent configuration
 * @returns A function that creates agent instances
 *
 * @remarks
 * The agent IS a behavioral program, not a class.
 * It coordinates:
 * - Inference model for generation
 * - Tool execution with sandboxing
 * - Tiered analysis (static → judge → browser)
 * - Workflow constraints via bThreads
 *
 * Extensibility pattern:
 * - `customHandlers` override default event handlers
 * - `customBThreads` add or replace constraints
 * - `preferences` enable hybrid UI
 */
export const createWorldAgent = (config: WorldAgentConfig) => {
  const {
    tools,
    model,
    contextBudget = createContextBudget(),
    customHandlers = {},
    customBThreads = {},
    constraints = {},
    preferences,
  } = config

  // Create code executor
  const codeExecutor = createCodeExecutor({ tools })

  return useBehavioral<WorldAgentEvents, WorldAgentContext>({
    publicEvents: [...PUBLIC_EVENTS],

    async bProgram({ trigger, bThreads, bSync, bThread, disconnect, outbound }) {
      // ================================================================
      // 1. Register workflow constraints
      // ================================================================
      registerWorkflowConstraints(bThreads, bSync, bThread, {
        contextBudget,
        skipTier2: constraints.skipTier2,
      })

      // ================================================================
      // 2. Register preference constraints (if provided)
      // ================================================================
      if (preferences) {
        bThreads.set({
          enforcePreferences: createPreferenceConstraint(bSync, bThread, preferences),
        })
      }

      // ================================================================
      // 3. Register custom bThreads (can override defaults)
      // ================================================================
      if (Object.keys(customBThreads).length > 0) {
        bThreads.set(customBThreads)
      }

      // ================================================================
      // 4. Define default handlers with full implementations
      // ================================================================
      const defaultHandlers = {
        /**
         * Generate handler - main workflow entry point.
         * Calls the inference model to get tool calls, executes them,
         * and runs static analysis on generated templates.
         */
        async generate({ intent, context: _context }: { intent: string; context?: unknown }) {
          try {
            // Emit thought for observability
            outbound.set({ kind: 'thought', content: `Processing: ${intent}` })

            // Call model inference to get tool calls
            const toolCalls = await model.inference(intent, tools.schemas)

            // If model returned tool calls, process them
            if (toolCalls.length > 0) {
              // Emit tool calls event
              outbound.set({ kind: 'toolCall', calls: toolCalls })
              trigger({ type: 'toolCall', detail: { calls: toolCalls } })

              // Execute each tool call
              for (const call of toolCalls) {
                const result = await tools.execute(call)

                // Emit result for observability
                outbound.set({ kind: 'toolResult', name: call.name, result })
                trigger({ type: 'toolResult', detail: { name: call.name, result } })

                // Run static analysis on template results (Tier 1 validation)
                if (call.name === 'writeTemplate' && result.success) {
                  const content = (result.data as { content?: string })?.content
                  if (content) {
                    const analysisResult = runStaticAnalysis(content, {
                      checks: constraints.staticChecks as StaticAnalysisOptions['checks'],
                    })
                    outbound.set({ kind: 'staticAnalysis', result: analysisResult })
                    trigger({ type: 'staticAnalysis', detail: analysisResult })
                  }
                }
              }
            }

            // Emit completion
            trigger({ type: 'generationComplete', detail: undefined })
            outbound.set({ kind: 'response', content: `Completed processing: ${intent}` })
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error))
            trigger({ type: 'error', detail: { error: err } })
            outbound.set({ kind: 'error', error: err })
          }
        },

        /**
         * Execute code in sandbox.
         * Runs arbitrary code with tool access in a sandboxed environment.
         */
        async executeCode({ code, sandbox: _sandbox }: { code: string; sandbox?: SandboxConfig }) {
          try {
            const result = await codeExecutor.execute(code)

            // Report tool calls made during execution
            if (result.toolCalls) {
              for (const call of result.toolCalls) {
                outbound.set({
                  kind: 'toolResult',
                  name: call.name,
                  result: { success: true, data: call.result },
                })
              }
            }

            // Emit completion status
            outbound.set({
              kind: 'response',
              content: result.success ? 'Code execution completed' : `Code execution failed: ${result.error}`,
            })
          } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error))
            outbound.set({ kind: 'error', error: err })
          }
        },

        /**
         * Chain multiple tool calls.
         * Executes tools either sequentially or in parallel.
         */
        async chainTools({ calls, sequential = false }: { calls: FunctionCall[]; sequential?: boolean }) {
          if (sequential) {
            // Execute in order, each awaited before the next
            for (const call of calls) {
              const result = await tools.execute(call)
              outbound.set({ kind: 'toolResult', name: call.name, result })
              trigger({ type: 'toolResult', detail: { name: call.name, result } })
            }
          } else {
            // Execute in parallel
            await Promise.all(
              calls.map(async (call) => {
                const result = await tools.execute(call)
                outbound.set({ kind: 'toolResult', name: call.name, result })
                trigger({ type: 'toolResult', detail: { name: call.name, result } })
              }),
            )
          }
        },

        /**
         * Resolve a tool by name and source.
         * Returns the tool handler if found, undefined otherwise.
         */
        resolveTool({ name, source: _source = 'local' }: { name: string; source?: ToolSource }) {
          // Look up tool in registry by finding matching schema
          const schema = tools.schemas.find((s) => s.name === name)
          if (!schema) {
            outbound.set({
              kind: 'error',
              error: new Error(`Tool not found: ${name}`),
            })
          }
          // Tool execution happens through tools.execute(), not direct handler access
        },

        /**
         * Cancel current operation.
         * Triggers an error event to interrupt any ongoing generation.
         */
        cancel() {
          const err = new Error('Operation cancelled by user')
          trigger({ type: 'error', detail: { error: err } })
          outbound.set({ kind: 'error', error: err })
        },

        /**
         * Handle feedback from story execution.
         * Used for reward computation in training.
         */
        feedback({ result }: { result: StoryResult }) {
          trigger({ type: 'browserTest', detail: { result } })

          // Emit feedback for observability
          if (!result.passed) {
            outbound.set({
              kind: 'error',
              error: new Error(`Story failed: ${result.errors.join(', ')}`),
            })
          }
          if (!result.a11yPassed) {
            outbound.set({
              kind: 'error',
              error: new Error('Accessibility check failed'),
            })
          }
        },

        /**
         * Disconnect the agent.
         * Cleans up resources and ends the behavioral program.
         */
        disconnect() {
          disconnect()
        },

        // ============================================================
        // Internal event handlers (coordination only)
        // ============================================================

        /** Internal: Static analysis completed - logged for trajectory */
        staticAnalysis({ passed, checks }: { passed: boolean; tier: 1; checks: unknown[] }) {
          if (!passed) {
            const failedChecks = checks.filter((c: unknown) => !(c as { passed: boolean }).passed)
            outbound.set({
              kind: 'error',
              error: new Error(`Static analysis failed: ${failedChecks.length} checks failed`),
            })
          }
        },

        /** Internal: Model-as-judge completed - logged for trajectory */
        modelJudge({ passed, score, reasoning }: { passed: boolean; score: number; reasoning: string }) {
          if (!passed) {
            outbound.set({
              kind: 'error',
              error: new Error(`Model judge failed (score: ${score}): ${reasoning}`),
            })
          }
        },

        /** Internal: Generation completed */
        generationComplete() {
          // Signal that generation is done - bThreads may use this
        },

        /** Internal: Tool call initiated */
        toolCall({ calls: _calls }: { calls: FunctionCall[] }) {
          // Log tool calls for trajectory generation
          // bThreads can block specific tool calls
        },

        /** Internal: Tool execution result */
        toolResult({ name, result }: { name: string; result: ToolResult }) {
          if (!result.success) {
            outbound.set({
              kind: 'error',
              error: new Error(`Tool ${name} failed: ${result.error}`),
            })
          }
        },

        /** Internal: Browser test completed */
        browserTest({ result }: { result: StoryResult }) {
          // Browser test results feed into reward computation
          if (!result.passed) {
            outbound.set({
              kind: 'error',
              error: new Error(`Browser test failed: ${result.errors.join(', ')}`),
            })
          }
        },

        /** Internal: Error occurred */
        error({ error }: { error: Error }) {
          // Errors are already emitted - this handler enables bThread coordination
          outbound.set({ kind: 'error', error })
        },
      }

      // ================================================================
      // 5. Merge custom handlers (can override defaults)
      // ================================================================
      return { ...defaultHandlers, ...customHandlers } as Handlers<WorldAgentEvents>
    },
  })
}

// ============================================================================
// Convenience Wrapper
// ============================================================================

/**
 * Convenience wrapper that creates a world agent with auto-created infrastructure.
 *
 * @param config - Minimal agent configuration (tools and model required)
 * @returns Promise resolving to trigger function
 *
 * @remarks
 * This is the simple API for quick usage. For full control over
 * signals and context, use `createWorldAgent` directly.
 *
 * @example
 * ```typescript
 * const { trigger, outbound } = await useWorldAgent({
 *   tools: myToolRegistry,
 *   model: myInferenceModel,
 * })
 *
 * trigger({ type: 'generate', detail: { intent: 'Create a button' } })
 * ```
 */
export const useWorldAgent = async (config: WorldAgentConfig) => {
  const {
    tools,
    model,
    contextBudget = createContextBudget(),
    customHandlers,
    customBThreads,
    constraints,
    preferences,
  } = config

  // Create outbound signal for agent events
  const outbound = useSignal<AgentOutEvent>()

  // Create code executor
  const codeExecutor = createCodeExecutor({ tools })

  // Create factory with full config
  const factory = createWorldAgent({
    tools,
    model,
    contextBudget,
    customHandlers,
    customBThreads,
    constraints,
    preferences,
  })

  // Initialize the agent with context
  const trigger = await factory({
    outbound,
    tools,
    model,
    contextBudget,
    codeExecutor,
    preferences,
    constraints,
  })

  return { trigger, outbound }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Create a minimal world agent for testing.
 *
 * @param tools - Tool registry
 * @param model - Inference model
 * @returns Agent trigger function and outbound signal
 */
export const createMinimalAgent = async (tools: ToolRegistry, model: InferenceModel) => {
  return useWorldAgent({ tools, model })
}

/**
 * Type for the initialized world agent result.
 */
export type WorldAgentResult = Awaited<ReturnType<typeof useWorldAgent>>
