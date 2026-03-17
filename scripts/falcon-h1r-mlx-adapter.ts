/**
 * Falcon H1R 7B MLX trial adapter — connects to a local MLX server for inference.
 *
 * @remarks
 * **Apple Silicon only** — uses MLX as the inference backend. For CUDA/ROCm
 * machines, use `falcon-h1r-llamacpp-adapter.ts` (future) instead.
 *
 * Loaded by the trial runner via `loadAdapter('scripts/falcon-h1r-mlx-adapter.ts')`.
 * Expects an MLX server running at `FALCON_BASE_URL` (default: `http://localhost:8080`).
 *
 * Start the server:
 * ```bash
 * .venv/bin/mlx_lm.server --model mlx-community/Falcon-H1R-7B-4bit --port 8080
 * ```
 *
 * The adapter calls the OpenAI-compatible `/v1/chat/completions` endpoint
 * with streaming disabled, captures the response, and returns a structured
 * `AdapterResult` with timing and token usage.
 *
 * @packageDocumentation
 */

import type { Adapter, AdapterResult, TrajectoryStep } from '../src/improve/trial.schemas.ts'

// ============================================================================
// Configuration
// ============================================================================

const FALCON_BASE_URL = process.env.FALCON_BASE_URL ?? 'http://localhost:8080'
const FALCON_MODEL = process.env.FALCON_MODEL ?? 'mlx-community/Falcon-H1R-7B-4bit'
const FALCON_MAX_TOKENS = Number(process.env.FALCON_MAX_TOKENS ?? '2048')
const FALCON_TEMPERATURE = Number(process.env.FALCON_TEMPERATURE ?? '0.6')
const FALCON_TIMEOUT_MS = Number(process.env.FALCON_TIMEOUT_MS ?? '300000') // 5 min default

// ============================================================================
// Types (OpenAI-compatible response shape from MLX server)
// ============================================================================

type ChatCompletionResponse = {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    message: {
      role: string
      content: string
    }
    finish_reason: string | null
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

// ============================================================================
// Server health check
// ============================================================================

/**
 * Check if the MLX server is reachable.
 *
 * @internal
 */
const checkServer = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${FALCON_BASE_URL}/v1/models`, {
      signal: AbortSignal.timeout(5000),
    })
    return response.ok
  } catch {
    return false
  }
}

// ============================================================================
// Adapter
// ============================================================================

/**
 * Falcon H1R 7B adapter for the trial runner.
 *
 * @remarks
 * Sends prompts to a local MLX inference server via the OpenAI-compatible API.
 * The adapter measures wall-clock time and extracts token usage from the response.
 *
 * Supports both single-turn (`prompt: string`) and multi-turn (`prompt: string[]`)
 * inputs. Multi-turn prompts are sent as alternating user messages.
 *
 * @public
 */
export const adapt: Adapter = async ({ prompt }) => {
  const turns = Array.isArray(prompt) ? prompt : [prompt]
  const start = Date.now()

  // Verify server is running
  const serverUp = await checkServer()
  if (!serverUp) {
    return {
      output: `Falcon H1R server not reachable at ${FALCON_BASE_URL}. Start it with:\n  .venv/bin/mlx_lm.server --model ${FALCON_MODEL} --port 8080`,
      timing: { total: Date.now() - start },
      exitCode: 1,
    }
  }

  // Build messages array — alternating user/assistant for multi-turn
  const messages: Array<{ role: string; content: string }> = []
  for (let i = 0; i < turns.length; i++) {
    messages.push({ role: 'user', content: turns[i]! })
    // For multi-turn, all but the last get a placeholder assistant response
    if (i < turns.length - 1) {
      messages.push({ role: 'assistant', content: '(continued)' })
    }
  }

  const trajectory: TrajectoryStep[] = []
  let result: AdapterResult

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), FALCON_TIMEOUT_MS)

    const response = await fetch(`${FALCON_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: FALCON_MODEL,
        messages,
        max_tokens: FALCON_MAX_TOKENS,
        temperature: FALCON_TEMPERATURE,
        stream: false,
      }),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    const elapsed = Date.now() - start

    if (!response.ok) {
      const errorText = await response.text()
      return {
        output: `MLX server error (${response.status}): ${errorText}`,
        timing: { total: elapsed },
        exitCode: 1,
      }
    }

    const completion = (await response.json()) as ChatCompletionResponse
    const output = completion.choices[0]?.message.content ?? ''
    const finishReason = completion.choices[0]?.finish_reason

    // Record the response as a trajectory message
    trajectory.push({
      type: 'message',
      content: output,
      timestamp: Date.now(),
    })

    result = {
      output,
      trajectory,
      timing: {
        total: elapsed,
        ...(completion.usage && {
          inputTokens: completion.usage.prompt_tokens,
          outputTokens: completion.usage.completion_tokens,
        }),
      },
      exitCode: 0,
      timedOut: finishReason === 'length',
    }
  } catch (error) {
    const elapsed = Date.now() - start
    const isAbort = error instanceof DOMException && error.name === 'AbortError'

    result = {
      output: isAbort
        ? `Falcon H1R inference timed out after ${FALCON_TIMEOUT_MS}ms`
        : `Falcon H1R inference error: ${error instanceof Error ? error.message : String(error)}`,
      trajectory: trajectory.length > 0 ? trajectory : undefined,
      timing: { total: elapsed },
      exitCode: 1,
      timedOut: isAbort,
    }
  }

  return result
}
