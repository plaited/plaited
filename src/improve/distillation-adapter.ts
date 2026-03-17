/**
 * In-process trial adapter using {@link createAgentLoop} directly.
 *
 * @remarks
 * Avoids subprocess overhead for fast pass@k evaluation. Each invocation
 * creates an ephemeral agent loop, triggers the task through the BP pipeline,
 * collects trajectory events, and tears down. The session lifecycle
 * (`client_connected` → `task` → `message` → `client_disconnected`)
 * is simulated to satisfy the agent loop's `sessionGate` bThread.
 *
 * @packageDocumentation
 */

import { AGENT_EVENTS } from '../agent/agent.constants.ts'
import { type CreateAgentLoopOptions, createAgentLoop } from '../agent/create-agent-loop.ts'
import type { ToolDefinition } from '../agent/agent.schemas.ts'
import type { MessageDetail, Model, ToolExecutor, ToolResultDetail } from '../agent/agent.types.ts'
import { UI_ADAPTER_LIFECYCLE_EVENTS } from '../events.ts'
import type { Adapter, AdapterResult, TrajectoryStep } from './trial.schemas.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the local adapter.
 *
 * @public
 */
export type LocalAdapterOptions = {
  model: Model
  tools: ToolDefinition[]
  toolExecutor: ToolExecutor
  memoryPath: string
  systemPrompt?: string
  maxIterations?: number
  constitution?: CreateAgentLoopOptions['constitution']
  goals?: CreateAgentLoopOptions['goals']
}

// ============================================================================
// Factory
// ============================================================================

/**
 * Create an in-process trial adapter that runs prompts through `createAgentLoop`.
 *
 * @remarks
 * Each call to the returned adapter:
 * 1. Creates a fresh `AgentNode` with a random session ID
 * 2. Subscribes to pipeline events to build trajectory
 * 3. Simulates the lifecycle (`client_connected` → `task` → message)
 * 4. Resolves with `AdapterResult` when the agent emits `message`
 * 5. Destroys the agent (cleanup AbortControllers, disconnect handlers)
 *
 * @param opts - Agent loop configuration
 * @returns Adapter function for the trial runner
 *
 * @public
 */
export const createLocalAdapter = (opts: LocalAdapterOptions): Adapter => {
  const { model, tools, toolExecutor, memoryPath, systemPrompt, maxIterations, constitution, goals } = opts

  return async ({ prompt }) => {
    const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
    const start = Date.now()
    const sessionId = crypto.randomUUID()
    const trajectory: TrajectoryStep[] = []
    let output = ''
    let inputTokens = 0
    let outputTokens = 0

    const agent = await createAgentLoop({
      model,
      tools,
      toolExecutor,
      memoryPath,
      sessionId,
      systemPrompt,
      maxIterations,
      constitution,
      goals,
    })

    try {
      const result = await new Promise<AdapterResult>((resolve, _reject) => {
        let settled = false
        const timeout = setTimeout(() => {
          finish({
            output: output || '',
            trajectory: trajectory.length > 0 ? trajectory : undefined,
            timing: { total: Date.now() - start, inputTokens, outputTokens },
            timedOut: true,
          })
        }, 300_000) // 5 minute safety timeout

        let disconnectSubscription = () => {}

        const finish = (result: AdapterResult) => {
          if (settled) return
          settled = true
          clearTimeout(timeout)
          disconnectSubscription()
          agent.trigger({
            type: UI_ADAPTER_LIFECYCLE_EVENTS.client_disconnected,
            detail: {
              sessionId,
              code: result.exitCode === 0 ? 1000 : 1011,
              reason: result.timedOut ? 'Local adapter timed out' : 'Local adapter complete',
            },
          })
          resolve(result)
        }

        // Subscribe to events for trajectory capture
        disconnectSubscription = agent.subscribe({
          [AGENT_EVENTS.thinking_delta](detail: unknown) {
            const { content } = detail as { content: string }
            // Accumulate thinking into a single trajectory step
            const last = trajectory[trajectory.length - 1]
            if (last?.type === 'thought') {
              last.content += content
            } else {
              trajectory.push({ type: 'thought', content, timestamp: Date.now() })
            }
          },

          [AGENT_EVENTS.text_delta](detail: unknown) {
            const { content } = detail as { content: string }
            output += content
          },

          [AGENT_EVENTS.tool_result](detail: unknown) {
            const { result: toolResult } = detail as ToolResultDetail
            trajectory.push({
              type: 'tool_call',
              name: toolResult.name,
              status: toolResult.status,
              output: toolResult.output,
              duration: toolResult.duration,
              timestamp: Date.now(),
            })
          },

          [AGENT_EVENTS.model_response](detail: unknown) {
            const { usage } = detail as { usage: { inputTokens: number; outputTokens: number } }
            inputTokens += usage.inputTokens ?? 0
            outputTokens += usage.outputTokens ?? 0
          },

          [AGENT_EVENTS.message](detail: unknown) {
            const { content, source } = detail as MessageDetail
            if (source === 'proactive') return
            trajectory.push({ type: 'message', content, timestamp: Date.now() })
            // Use final message content as output if text_delta didn't accumulate
            if (!output) output = content

            finish({
              output,
              trajectory: trajectory.length > 0 ? trajectory : undefined,
              timing: {
                total: Date.now() - start,
                ...(inputTokens > 0 && { inputTokens }),
                ...(outputTokens > 0 && { outputTokens }),
              },
              exitCode: 0,
            })
          },

          [AGENT_EVENTS.inference_error](detail: unknown) {
            const { error } = detail as { error: string }
            // Only reject on non-retryable errors after max retries
            // The agent loop handles retries internally; inference_error
            // with message event means it gave up and we'll get message
            trajectory.push({
              type: 'message',
              content: `Inference error: ${error}`,
              timestamp: Date.now(),
            })
          },
        })

        // Simulate WebSocket lifecycle: connect → task
        agent.trigger({
          type: UI_ADAPTER_LIFECYCLE_EVENTS.client_connected,
          detail: { sessionId, source: 'local-adapter', isReconnect: false },
        })
        agent.trigger({
          type: AGENT_EVENTS.task,
          detail: { prompt: text },
        })
      })

      return result
    } catch (error) {
      return {
        output: error instanceof Error ? error.message : String(error),
        trajectory: trajectory.length > 0 ? trajectory : undefined,
        timing: { total: Date.now() - start },
        exitCode: 1,
      }
    } finally {
      agent.destroy()
    }
  }
}
