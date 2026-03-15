import type { AgentToolCall } from './agent.schemas.ts'
import type { ChatMessage, Model } from './agent.types.ts'
import { collectModelText } from './agent.utils.ts'

// ============================================================================
// Prompt Templates
// ============================================================================

/**
 * State Transition Prompt for the Dreamer (Layer 4).
 *
 * @remarks
 * Adapted from WebDreamer A.3. Instructs the model to predict only
 * state changes — stdout, errors, file diffs — without executing
 * the tool call. Used as the system prompt for simulation inference.
 *
 * @public
 */
export const STATE_TRANSITION_PROMPT = `You are a simulation engine. Given the conversation context and a proposed tool call, predict ONLY the state changes that would occur if this tool call were executed.

Do NOT execute the tool call. Predict the outcome.

Output your prediction in the following format:

PREDICTED OUTPUT:
<what stdout/return value would be>

PREDICTED CHANGES:
- <change 1: file modification, state change, error, etc.>
- <change 2>

If the tool call would result in an error, predict the error message.
If the tool call would modify files, predict the diff.
If the tool call would produce console output, predict the output.

Be specific and concrete. Do not hedge or speculate beyond what the tool would actually do.`

// ============================================================================
// Types
// ============================================================================

/**
 * Result of a simulation (Dreamer prediction).
 *
 * @remarks
 * `predictedOutput` is the full model response text.
 * `predictedChanges` is a parsed list of individual changes
 * extracted from the "PREDICTED CHANGES:" section.
 *
 * @public
 */
export type SimulateResult = {
  predictedOutput: string
  predictedChanges: string[]
}

// ============================================================================
// Internal helpers
// ============================================================================

const PREDICTED_CHANGES_HEADER = /PREDICTED CHANGES:\s*\n([\s\S]*?)(?:\n\n|$)/
const CHANGE_LINE = /^-\s+(.+)$/gm

const formatToolCall = (toolCall: AgentToolCall): string =>
  `Tool: ${toolCall.name}\nArguments: ${JSON.stringify(toolCall.arguments, null, 2)}`

/**
 * Parses the raw prediction text into structured output.
 *
 * @internal
 */
export const parsePrediction = (text: string): SimulateResult => {
  const predictedChanges: string[] = []
  const changesMatch = text.match(PREDICTED_CHANGES_HEADER)
  if (changesMatch?.[1]) {
    const regex = new RegExp(CHANGE_LINE.source, 'gm')
    for (let match = regex.exec(changesMatch[1]); match !== null; match = regex.exec(changesMatch[1])) {
      if (match[1]) predictedChanges.push(match[1].trim())
    }
  }

  return { predictedOutput: text, predictedChanges }
}

// ============================================================================
// simulate — Dreamer (Layer 4)
// ============================================================================

/**
 * Predicts the outcome of a tool call without executing it.
 *
 * @remarks
 * Constructs a State Transition Prompt (adapted from WebDreamer A.3)
 * and calls `Model.reason()` to get the model's prediction of what
 * would happen if the tool call were executed. The conversation
 * `history` provides context for accurate prediction.
 *
 * This is a pure async function — the agent loop wires it into the
 * BP event flow via `useFeedback` on `simulate_request`.
 *
 * @param opts.toolCall - The proposed tool call to simulate
 * @param opts.history - Conversation history for context
 * @param opts.model - Model interface for inference
 * @param opts.signal - Optional abort signal
 * @returns Structured prediction with parsed changes
 *
 * @public
 */
export const simulate = async ({
  toolCall,
  history,
  model,
  signal,
}: {
  toolCall: AgentToolCall
  history: ChatMessage[]
  model: Model
  signal?: AbortSignal
}): Promise<SimulateResult> => {
  const effectiveSignal = signal ?? AbortSignal.timeout(30_000)

  const messages: ChatMessage[] = [
    { role: 'system', content: STATE_TRANSITION_PROMPT },
    ...history,
    {
      role: 'user',
      content: `Predict the outcome of the following tool call:\n\n${formatToolCall(toolCall)}`,
    },
  ]

  const text = await collectModelText(model.reason({ messages, temperature: 0, signal: effectiveSignal }), signal)

  return parsePrediction(text)
}
