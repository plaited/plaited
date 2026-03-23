/**
 * vLLM inference adapter for Plaited autoresearch.
 *
 * @remarks
 * Calls an OpenAI-compatible vLLM server for code generation.
 * Intended to talk to an MSI-hosted vLLM endpoint; this Mac is the operator
 * and control-plane box, not the target serving machine.
 *
 * Prerequisites:
 * 1. Start the MSI-side vLLM server: `bun scripts/vllm-server.ts`
 * 2. Set VLLM_API_URL to the reachable MSI endpoint
 *
 * Environment variables:
 * - VLLM_API_URL: vLLM API endpoint
 * - VLLM_MODEL_NAME: Model name for API (default: falcon-7b)
 * - VLLM_MAX_TOKENS: Max completion tokens (default: 2048)
 * - VLLM_TEMPERATURE: Sampling temperature (default: 0.7)
 */

import type { Adapter } from '../src/improve.ts'

const API_URL = (process.env.VLLM_API_URL || 'http://localhost:8000/v1').replace(/\/$/, '')
const MODEL_NAME = process.env.VLLM_MODEL_NAME || 'falcon-7b'
const MAX_TOKENS = parseInt(process.env.VLLM_MAX_TOKENS || '2048', 10)
const TEMPERATURE = parseFloat(process.env.VLLM_TEMPERATURE || '0.7')
const TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes

const SYSTEM_PROMPT = `You are improving Plaited itself, not adding a shipped product feature.

Priorities:
1. Strengthen the runtime for a sovereign personal agent node.
2. Improve the developer-side autoresearch loop for bounded framework work.
3. Keep changes tightly scoped to the declared slice.

Rules:
- Follow the architecture and slice files exactly.
- Prefer small bounded edits over broad rewrites.
- Preserve Bun-native patterns.
- Leave the repo in a testable state.
- Summarize what changed in the final response.
`

interface VLLMRequest {
  model: string
  messages: Array<{
    role: 'system' | 'user' | 'assistant'
    content: string
  }>
  temperature: number
  max_tokens: number
}

interface VLLMResponse {
  choices: Array<{
    message: {
      content: string
    }
  }>
  usage?: {
    prompt_tokens: number
    completion_tokens: number
    total_tokens: number
  }
}

export const adapt: Adapter = async ({ prompt }) => {
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const start = Date.now()

  try {
    // Health check
    try {
      const healthRes = await fetch(`${API_URL}/models`, {
        signal: AbortSignal.timeout(5000),
      })
      if (!healthRes.ok) {
        throw new Error(`vLLM server health check failed: ${healthRes.status}`)
      }
    } catch (_error) {
      throw new Error(`vLLM server unavailable at ${API_URL}. Start it with: bun scripts/vllm-server.ts`)
    }

    const payload: VLLMRequest = {
      model: MODEL_NAME,
      messages: [
        {
          role: 'system',
          content: SYSTEM_PROMPT,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      temperature: TEMPERATURE,
      max_tokens: MAX_TOKENS,
    }

    const response = await fetch(`${API_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`vLLM API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as VLLMResponse

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No completions returned from vLLM')
    }

    const choice = data.choices[0]
    const output = choice?.message?.content ?? ''

    if (!output) {
      throw new Error('Empty response from vLLM')
    }

    const elapsed = Date.now() - start

    return {
      output,
      timing: {
        total: elapsed,
        ...(data.usage?.prompt_tokens && { inputTokens: data.usage.prompt_tokens }),
        ...(data.usage?.completion_tokens && { outputTokens: data.usage.completion_tokens }),
      },
      exitCode: 0,
      timedOut: false,
    }
  } catch (error) {
    const elapsed = Date.now() - start
    const isTimeout = error instanceof Error && error.message.includes('AbortSignal.timeout')

    return {
      output: error instanceof Error ? error.message : String(error),
      timing: {
        total: elapsed,
      },
      exitCode: 1,
      timedOut: isTimeout,
    }
  }
}
