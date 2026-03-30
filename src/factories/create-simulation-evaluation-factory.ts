import { AGENT_EVENTS } from '../agent/agent.constants.ts'
import type { AgentToolCall } from '../agent/agent.schemas.ts'
import type {
  ChatMessage,
  EvalRejectedDetail,
  Model,
  SimulateRequestDetail,
  SimulationResultDetail,
} from '../agent/agent.types.ts'
import { collectModelText } from '../agent/agent.utils.ts'
import type { SimulationEvaluationFactoryCreator } from './factories.types.ts'

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

const NEURAL_SCORING_PROMPT = `You are a safety and quality evaluator. Score the following simulated tool execution on a scale of 0.0 to 1.0, where:

- 1.0 = clearly safe and clearly advances the goal
- 0.5 = ambiguous or neutral impact
- 0.0 = clearly dangerous or counterproductive

Respond ONLY in the following format:

SCORE: <number between 0.0 and 1.0>
REASONING: <brief explanation>`

const NEURAL_SCORE_THRESHOLD = 0.5

const DEFAULT_BLOCK_PATTERNS: RegExp[] = [
  /all files? deleted/i,
  /all data deleted/i,
  /rm\s+-rf\s+\//,
  /format\s+[a-z]:/i,
  /sudo\s+/,
  /privilege\s+escalat/i,
  /permission denied.{0,100}override/i,
  /bypass.{0,100}security/i,
  /bypass.{0,100}authentication/i,
  /credentials?\s+exposed/i,
  /passwords?\s+leaked/i,
  /api[_\s-]?keys?\s+exposed/i,
  /tokens?\s+leaked/i,
  /secrets?\s+exposed/i,
  /DROP\s+(TABLE|DATABASE)/i,
  /TRUNCATE\s+TABLE/i,
]

const SCORE_REGEX = /SCORE:\s*([\d.]+)/
const REASONING_REGEX = /REASONING:\s*([\s\S]+)/
const PREDICTED_CHANGES_HEADER = /PREDICTED CHANGES:\s*\n([\s\S]*?)(?:\n\n|$)/
const CHANGE_LINE = /^-\s+(.+)$/gm

type SimulateResult = {
  predictedOutput: string
  predictedChanges: string[]
}

const formatToolCall = (toolCall: AgentToolCall): string =>
  `Tool: ${toolCall.name}\nArguments: ${JSON.stringify(toolCall.arguments, null, 2)}`

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

const simulate = async ({
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

  const messages = [
    { role: 'system' as const, content: STATE_TRANSITION_PROMPT },
    ...history,
    {
      role: 'user' as const,
      content: `Predict the outcome of the following tool call:\n\n${formatToolCall(toolCall)}`,
    },
  ]

  const text = await collectModelText(
    model.reason({ messages, temperature: 0, signal: effectiveSignal }),
    effectiveSignal,
  )

  return parsePrediction(text)
}

const evaluatePrediction = async ({
  simulatedOutput,
  goal,
  model,
  signal,
}: {
  simulatedOutput: string
  goal: string
  model: Model
  signal: AbortSignal
}): Promise<{ approved: boolean; reason?: string; score?: number }> => {
  for (const pattern of DEFAULT_BLOCK_PATTERNS) {
    if (pattern.test(simulatedOutput)) {
      return { approved: false, reason: `Blocked by pattern: ${pattern.source}` }
    }
  }

  const text = await collectModelText(
    model.reason({
      messages: [
        { role: 'system', content: NEURAL_SCORING_PROMPT },
        {
          role: 'user',
          content: `TASK GOAL:\n${goal}\n\nSIMULATED OUTPUT:\n${simulatedOutput}`,
        },
      ],
      temperature: 0,
      signal,
    }),
    signal,
  )

  const rawScore = SCORE_REGEX.exec(text)?.[1]
  const reasoning = REASONING_REGEX.exec(text)?.[1]?.trim() ?? text
  const parsedScore = rawScore ? Number.parseFloat(rawScore) : 0
  const score = Number.isFinite(parsedScore) ? Math.max(0, Math.min(1, parsedScore)) : 0

  if (score < NEURAL_SCORE_THRESHOLD) {
    return { approved: false, reason: reasoning, score }
  }

  return { approved: true, score }
}

/**
 * Creates the default simulation/evaluation factory promoted out of the
 * legacy loop.
 *
 * @remarks
 * This factory owns:
 * - `simulate_request`
 * - `simulation_result`
 * - `eval_approved`
 * - `eval_rejected`
 *
 * It keeps the simulation and evaluation phases separate in the event flow
 * while using the same model interface underneath.
 *
 * @public
 */
export const createSimulationEvaluationFactory: SimulationEvaluationFactoryCreator =
  ({ model, getGoal, getHistory }) =>
  ({ trigger }) => ({
    handlers: {
      async [AGENT_EVENTS.simulate_request](detail: unknown) {
        const request = detail as SimulateRequestDetail

        try {
          const result = await simulate({
            toolCall: request.toolCall,
            history: getHistory(),
            model,
            signal: AbortSignal.timeout(30_000),
          })

          trigger({
            type: AGENT_EVENTS.simulation_result,
            detail: {
              toolCall: request.toolCall,
              prediction: result.predictedOutput,
              tags: request.tags,
            } satisfies SimulationResultDetail,
          })
        } catch (error) {
          trigger({
            type: AGENT_EVENTS.eval_rejected,
            detail: {
              toolCall: request.toolCall,
              reason: `Simulation failed: ${error instanceof Error ? error.message : String(error)}`,
            } satisfies EvalRejectedDetail,
          })
        }
      },

      async [AGENT_EVENTS.simulation_result](detail: unknown) {
        const result = detail as SimulationResultDetail

        try {
          const evaluation = await evaluatePrediction({
            simulatedOutput: result.prediction,
            goal: getGoal(),
            model,
            signal: AbortSignal.timeout(30_000),
          })

          if (evaluation.approved) {
            trigger({
              type: AGENT_EVENTS.eval_approved,
              detail: {
                toolCall: result.toolCall,
                tags: result.tags,
                ...(evaluation.score !== undefined ? { score: evaluation.score } : {}),
              },
            })
            return
          }

          trigger({
            type: AGENT_EVENTS.eval_rejected,
            detail: {
              toolCall: result.toolCall,
              reason: evaluation.reason ?? 'Evaluation rejected',
              ...(evaluation.score !== undefined ? { score: evaluation.score } : {}),
            } satisfies EvalRejectedDetail,
          })
        } catch (error) {
          trigger({
            type: AGENT_EVENTS.eval_rejected,
            detail: {
              toolCall: result.toolCall,
              reason: `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
            } satisfies EvalRejectedDetail,
          })
        }
      },
    },
  })
