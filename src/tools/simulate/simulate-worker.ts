/**
 * Sub-agent entry point for Dreamer simulation.
 *
 * @remarks
 * Runs in a `Bun.spawn()` subprocess. Receives simulation requests
 * via IPC, runs inference, and sends back predictions.
 * This script is NOT re-exported from the barrel — it's an entry point.
 *
 * @internal
 */
import type { AgentPlan, AgentToolCall } from '../../agent/agent.schemas.ts'
import type { ChatMessage } from '../../agent/agent.types.ts'
import { createInferenceCall } from '../../agent/agent.utils.ts'
import { buildStateTransitionPrompt, parseSimulationResponse } from './simulate.ts'

type SimulationRequest = {
  toolCall: AgentToolCall
  history: ChatMessage[]
  plan: AgentPlan | null
  inferenceConfig: { baseUrl: string; model: string; temperature?: number }
}

process.on('message', async (message: unknown) => {
  const { toolCall, history, plan, inferenceConfig } = message as SimulationRequest
  try {
    const inferenceCall = createInferenceCall(inferenceConfig.baseUrl)
    const messages = buildStateTransitionPrompt({ toolCall, history, plan })
    const response = await inferenceCall({
      model: inferenceConfig.model,
      messages,
      temperature: inferenceConfig.temperature ?? 0,
    })
    const prediction = parseSimulationResponse(response)
    process.send!({ prediction })
  } catch (error) {
    process.send!({ error: error instanceof Error ? error.message : String(error) })
  }
})
