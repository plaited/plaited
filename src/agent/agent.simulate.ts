import type { AgentPlan, AgentToolCall } from './agent.schemas.ts'
import type { ChatMessage, InferenceCall, Simulate } from './agent.types.ts'

// ============================================================================
// Constants
// ============================================================================

/** Number of recent history entries to include in simulation context */
const HISTORY_SLICE = 6

const STATE_TRANSITION_SYSTEM = `You are a world model simulator. Given a proposed tool call and recent conversation context, predict the most likely outcome.

Rules:
- Predict what the tool call will return or what side effects it will cause
- Be concrete and specific — describe file contents, command output, error messages
- If the call is likely to fail, predict the failure mode
- Keep predictions concise (1-3 sentences)
- Output only the prediction text, no additional commentary`

// ============================================================================
// Prompt Builders
// ============================================================================

/**
 * Assembles the State Transition Prompt (WebDreamer A.3) for the Dreamer.
 *
 * @param args.toolCall - The proposed tool call to simulate
 * @param args.history - Conversation history (last 6 entries used)
 * @param args.plan - Current agent plan for additional context
 * @returns Chat messages array for the simulation inference call
 *
 * @public
 */
export const buildStateTransitionPrompt = ({
  toolCall,
  history,
  plan,
}: {
  toolCall: AgentToolCall
  history: ChatMessage[]
  plan: AgentPlan | null
}): ChatMessage[] => {
  let system = STATE_TRANSITION_SYSTEM
  if (plan) {
    system += `\n\nCurrent Plan — Goal: ${plan.goal}\nSteps:\n${plan.steps.map((s) => `- [${s.id}] ${s.intent} (tools: ${s.tools.join(', ')})`).join('\n')}`
  }

  const recentHistory = history.slice(-HISTORY_SLICE)

  const actionDescription = `Proposed tool call:
- Tool: ${toolCall.name}
- Arguments: ${JSON.stringify(toolCall.arguments)}

Predict the outcome of this tool call.`

  const messages: ChatMessage[] = [{ role: 'system', content: system }]
  if (recentHistory.length > 0) {
    messages.push(...recentHistory)
  }
  messages.push({ role: 'user', content: actionDescription })

  return messages
}

// ============================================================================
// Response Parser
// ============================================================================

const THINK_TAG_REGEX = /^<think>([\s\S]*?)<\/think>\s*/

/**
 * Parses a simulation response, stripping `<think>` tags.
 *
 * @remarks
 * Follows the same pattern as `parseModelResponse` in `agent.utils.ts`:
 * prefers `reasoning_content` field, falls back to `<think>` tag stripping.
 * Returns trimmed content string, or `''` for null/empty.
 *
 * @param response - Raw inference response
 * @returns Prediction text string
 *
 * @public
 */
export const parseSimulationResponse = (response: {
  choices: Array<{ message: { content?: string | null; reasoning_content?: string | null } }>
}): string => {
  const msg = response.choices[0]?.message
  if (!msg) return ''

  let content = msg.content ?? null

  // Strip <think> tags if no reasoning_content field
  if (!msg.reasoning_content && content) {
    const match = content.match(THINK_TAG_REGEX)
    if (match) {
      content = content.slice(match[0].length) || null
    }
  }

  return content?.trim() ?? ''
}

// ============================================================================
// Simulate Factories
// ============================================================================

/**
 * Creates an in-process `Simulate` function using a direct inference call.
 *
 * @remarks
 * Calls `inferenceCall` with state transition messages (no `tools` parameter).
 * Use this in tests and simple deployments. For parallel simulation in
 * production, use `createSubAgentSimulate()` instead.
 *
 * @param options.inferenceCall - Inference call function
 * @param options.model - Model identifier for simulation
 * @param options.temperature - Sampling temperature (default 0)
 * @returns A `Simulate` function
 *
 * @public
 */
export const createSimulate = ({
  inferenceCall,
  model,
  temperature = 0,
}: {
  inferenceCall: InferenceCall
  model: string
  temperature?: number
}): Simulate => {
  return async ({ toolCall, history, plan }) => {
    const messages = buildStateTransitionPrompt({ toolCall, history, plan })
    const response = await inferenceCall({ model, messages, temperature })
    return parseSimulationResponse(response)
  }
}

/**
 * Creates a sub-agent `Simulate` function that runs inference in a `Bun.spawn()` subprocess.
 *
 * @remarks
 * Spawns a new subprocess per simulation request using IPC. The main event loop
 * doesn't block on simulation — it continues processing read-only calls.
 * The subprocess is killed after receiving the result.
 *
 * @param options.workerPath - Path to the simulate worker script
 * @param options.inferenceConfig - Config passed to the worker for inference
 * @returns A `Simulate` function
 *
 * @public
 */
export const createSubAgentSimulate = ({
  workerPath,
  inferenceConfig,
}: {
  workerPath: string
  inferenceConfig: { baseUrl: string; model: string; temperature?: number }
}): Simulate => {
  return ({ toolCall, history, plan }) => {
    return new Promise<string>((resolve, reject) => {
      const proc = Bun.spawn(['bun', 'run', workerPath], {
        ipc(message) {
          const msg = message as { prediction?: string; error?: string }
          proc.kill()
          if (msg.error) {
            reject(new Error(msg.error))
          } else {
            resolve(msg.prediction ?? '')
          }
        },
        stdio: ['inherit', 'inherit', 'inherit'],
        serialization: 'json',
      })

      proc.send({ toolCall, history, plan, inferenceConfig })
    })
  }
}
