import { z } from 'zod'
import { RISK_CLASS } from '../../reference/agent.constants.ts'
import type { AgentToolCall } from '../../reference/agent.schemas.ts'
import type { ChatMessage, Evaluate, InferenceCall } from '../../reference/agent.types.ts'
import { EvaluateConfigSchema } from './evaluate.schemas.ts'

// ============================================================================
// Symbolic Gate — pattern matching on predicted output text
// ============================================================================

/** Default regex patterns for dangerous prediction detection */
export const DANGEROUS_PREDICTION_PATTERNS: RegExp[] = [
  /deleting database/i,
  /drop table/i,
  /permission denied/i,
  /fatal error/i,
  /segmentation fault/i,
  /kernel panic/i,
  /data loss/i,
  /credentials exposed/i,
  /\bdestroy\b/i,
  /removing all/i,
  /format disk/i,
  /unauthorized access/i,
]

/**
 * Checks a prediction string against dangerous patterns.
 *
 * @remarks
 * Returns whether the prediction matches any pattern and which text matched.
 * Exported so bThread block predicates can call it directly.
 *
 * @param prediction - Dreamer prediction text to check
 * @param patterns - Custom patterns (defaults to `DANGEROUS_PREDICTION_PATTERNS`)
 * @returns Object with `blocked` boolean and optional `reason` with matched text
 *
 * @public
 */
export const checkSymbolicGate = (
  prediction: string,
  patterns: RegExp[] = DANGEROUS_PREDICTION_PATTERNS,
): { blocked: boolean; reason?: string } => {
  if (!prediction) return { blocked: false }

  for (const pattern of patterns) {
    const match = prediction.match(pattern)
    if (match) {
      return { blocked: true, reason: `Prediction matched dangerous pattern: "${match[0]}"` }
    }
  }

  return { blocked: false }
}

// ============================================================================
// Neural Scorer — reward prompt for high-ambiguity evaluation
// ============================================================================

/**
 * Builds the Reward Prompt (WebDreamer A.4) for neural scoring.
 *
 * @param args.prediction - Dreamer's predicted outcome
 * @param args.toolCall - The proposed tool call being evaluated
 * @param args.goal - The current plan goal for progress assessment
 * @returns Chat messages array for the scoring inference call
 *
 * @public
 */
export const buildRewardPrompt = ({
  prediction,
  toolCall,
  goal,
}: {
  prediction: string
  toolCall: AgentToolCall
  goal: string
}): ChatMessage[] => {
  const system = `You are a reward model. Score the predicted outcome of a tool call relative to the goal.

Score scale:
- 1.0 = The predicted outcome fully accomplishes the goal or makes decisive progress
- 0.5 = The predicted outcome is on track, partial progress toward the goal
- 0.0 = The predicted outcome is incorrect, harmful, or moves away from the goal

Respond with ONLY a JSON object: {"score": <number>, "reason": "..."}`

  const user = `Goal: ${goal}

Tool call: ${toolCall.name}(${JSON.stringify(toolCall.arguments)})

Predicted outcome: ${prediction}

Score this prediction.`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

// ============================================================================
// Score Parser
// ============================================================================

const THINK_TAG_REGEX = /^<think>([\s\S]*?)<\/think>\s*/

/**
 * Extracts a reward score from a JSON inference response.
 *
 * @remarks
 * Strips `<think>` tags before parsing. Clamps to [0, 1] range.
 * Defaults to 0.5 (on-track) on parse failure — fail-open behavior.
 *
 * @param response - Raw inference response
 * @returns Object with `score` and optional `reason`
 *
 * @public
 */
export const parseRewardScore = (response: {
  choices: Array<{ message: { content?: string | null; reasoning_content?: string | null } }>
}): { score: number; reason?: string } => {
  const msg = response.choices[0]?.message
  if (!msg) return { score: 0.5 }

  let content = msg.content ?? ''

  // Strip <think> tags
  if (!msg.reasoning_content && content) {
    const match = content.match(THINK_TAG_REGEX)
    if (match) {
      content = content.slice(match[0].length)
    }
  }

  try {
    const parsed = JSON.parse(content.trim()) as { score?: number; reason?: string }
    if (typeof parsed.score !== 'number') return { score: 0.5 }

    // Clamp to [0, 1]
    const score = Math.max(0, Math.min(1, parsed.score))
    return { score, ...(parsed.reason && { reason: parsed.reason }) }
  } catch {
    return { score: 0.5 }
  }
}

// ============================================================================
// Evaluate Factory
// ============================================================================

/**
 * Creates an `Evaluate` function implementing the Judge.
 *
 * @remarks
 * Runs symbolic gate (5a) for all risk classes. Runs neural scorer (5b)
 * only for `high_ambiguity` when a `goal` is provided. The `scoreThreshold`
 * determines the minimum score for approval (default 0.5).
 *
 * @param options.inferenceCall - Inference call for neural scoring
 * @param options.model - Model identifier for scoring
 * @param options.scoreThreshold - Minimum score for approval (default 0.5)
 * @param options.patterns - Custom patterns for symbolic gate
 * @param options.temperature - Sampling temperature (default 0)
 * @returns An `Evaluate` function
 *
 * @public
 */
export const createEvaluate = ({
  inferenceCall,
  model,
  scoreThreshold = 0.5,
  patterns,
  temperature = 0,
}: {
  inferenceCall: InferenceCall
  model: string
  scoreThreshold?: number
  patterns?: RegExp[]
  temperature?: number
}): Evaluate => {
  return async ({ toolCall, prediction, riskClass, history: _history, goal }) => {
    // 5a: Symbolic gate — runs for all risk classes
    const symbolicResult = checkSymbolicGate(prediction, patterns)
    if (symbolicResult.blocked) {
      return { approved: false, reason: symbolicResult.reason }
    }

    // 5b: Neural scorer — only for high_ambiguity with a goal
    if (riskClass === RISK_CLASS.high_ambiguity && goal) {
      const messages = buildRewardPrompt({ prediction, toolCall, goal })
      const response = await inferenceCall({ model, messages, temperature })
      const { score, reason } = parseRewardScore(response)

      if (score < scoreThreshold) {
        return { approved: false, reason: reason ?? `Score ${score} below threshold ${scoreThreshold}`, score }
      }

      return { approved: true, score, reason }
    }

    // Symbolic gate passed, no neural scorer needed
    return { approved: true }
  }
}

// ============================================================================
// CLI Handler
// ============================================================================

export const evaluateCli = async (args: string[]): Promise<void> => {
  if (args.includes('--schema')) {
    // biome-ignore lint/suspicious/noConsole: CLI stdout output
    console.log(JSON.stringify(z.toJSONSchema(EvaluateConfigSchema), null, 2))
    return
  }
  const jsonIdx = args.indexOf('--json')
  const jsonArg = args[jsonIdx + 1]
  if (jsonIdx === -1 || !jsonArg) {
    console.error("Usage: plaited evaluate --json '{...}' | --schema")
    process.exit(1)
  }
  const parsed = EvaluateConfigSchema.safeParse(JSON.parse(jsonArg))
  if (!parsed.success) {
    console.error(JSON.stringify(parsed.error.issues, null, 2))
    process.exit(1)
  }
  const { prediction, patterns: patternStrings } = parsed.data
  const patterns = patternStrings?.map((p) => new RegExp(p, 'i'))
  const result = checkSymbolicGate(prediction, patterns)
  // biome-ignore lint/suspicious/noConsole: CLI stdout output
  console.log(JSON.stringify(result))
}
