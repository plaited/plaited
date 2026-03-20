/**
 * Thunder Compute H100 adapter for Plaited autoresearch.
 *
 * @remarks
 * Interfaces with Thunder Compute's REST API for cloud-based Llama 3.1 70B
 * inference with batching and retry logic.
 *
 * Environment variables:
 * - THUNDER_COMPUTE_API_KEY: API key for Thunder Compute
 * - THUNDER_COMPUTE_ENDPOINT: API endpoint (e.g., https://api.thundercompute.com/v1)
 * - THUNDER_COMPUTE_MODEL: Model name (e.g., meta-llama/Llama-3.1-70B)
 */

import type { Adapter, AdapterInput, AdapterResult } from '../src/improve.ts'

interface ThunderComputeRequest {
  model: string
  prompt: string
  max_tokens?: number
  temperature?: number
  top_p?: number
}

interface ThunderComputeChoice {
  text: string
  finish_reason: string
}

interface ThunderComputeUsage {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
}

interface ThunderComputeResponse {
  choices: ThunderComputeChoice[]
  usage?: ThunderComputeUsage
}

const THUNDER_COMPUTE_API_KEY = process.env.THUNDER_COMPUTE_API_KEY
const THUNDER_COMPUTE_ENDPOINT = process.env.THUNDER_COMPUTE_ENDPOINT
const THUNDER_COMPUTE_MODEL = process.env.THUNDER_COMPUTE_MODEL

if (!THUNDER_COMPUTE_API_KEY) {
  throw new Error('THUNDER_COMPUTE_API_KEY environment variable is required')
}
if (!THUNDER_COMPUTE_ENDPOINT) {
  throw new Error('THUNDER_COMPUTE_ENDPOINT environment variable is required')
}
if (!THUNDER_COMPUTE_MODEL) {
  throw new Error('THUNDER_COMPUTE_MODEL environment variable is required')
}

const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1000
const TIMEOUT_MS = 60 * 1000

type BatchRequest = {
  id: string
  input: AdapterInput
  resolve: (result: AdapterResult) => void
  reject: (error: unknown) => void
}

const batchQueue: BatchRequest[] = []
const BATCH_SIZE = 16
let batchTimer: Timer | null = null

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

const processBatch = async () => {
  if (batchQueue.length === 0) return

  const batch = batchQueue.splice(0, BATCH_SIZE)
  const promises = batch.map((req) => callThunderCompute(req))

  await Promise.allSettled(promises)

  if (batchQueue.length > 0) {
    batchTimer = setTimeout(processBatch, 100)
  }
}

const callThunderCompute = async (req: BatchRequest) => {
  const { input, resolve, reject } = req
  const text = Array.isArray(input.prompt) ? input.prompt.join('\n') : input.prompt
  const start = Date.now()

  try {
    let lastError: Error | null = null

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        const payload: ThunderComputeRequest = {
          model: THUNDER_COMPUTE_MODEL,
          prompt: `${SYSTEM_PROMPT}\n\n${text}`,
          max_tokens: 8000,
          temperature: 0.7,
          top_p: 0.9,
        }

        const response = await fetch(`${THUNDER_COMPUTE_ENDPOINT}/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${THUNDER_COMPUTE_API_KEY}`,
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        })

        if (!response.ok) {
          const error = new Error(`Thunder Compute API error: ${response.status} ${response.statusText}`)
          lastError = error
          if (attempt < MAX_RETRIES) {
            const delay = INITIAL_BACKOFF_MS * 2 ** attempt
            await new Promise((sleep) => setTimeout(sleep, delay))
            continue
          }
          throw error
        }

        const data = (await response.json()) as ThunderComputeResponse
        const elapsed = Date.now() - start

        if (!data || !data.choices || data.choices.length === 0) {
          throw new Error('No completions returned from Thunder Compute')
        }

        const choice = data.choices[0]
        const output = choice?.text ?? ''

        if (!output) {
          throw new Error('Empty response from Thunder Compute')
        }

        resolve({
          output,
          timing: {
            total: elapsed,
            ...(data.usage?.prompt_tokens !== undefined && { inputTokens: data.usage.prompt_tokens }),
            ...(data.usage?.completion_tokens !== undefined && { outputTokens: data.usage.completion_tokens }),
          },
          exitCode: 0,
          timedOut: false,
        })

        return
      } catch (error) {
        lastError = error as Error
        if (attempt < MAX_RETRIES) {
          const delay = INITIAL_BACKOFF_MS * 2 ** attempt
          await new Promise((sleep) => setTimeout(sleep, delay))
        }
      }
    }

    reject(lastError || new Error('Thunder Compute request failed'))
  } catch (error) {
    reject(error)
  }
}

const enqueueBatch = (input: AdapterInput): Promise<AdapterResult> => {
  return new Promise<AdapterResult>((resolve, reject) => {
    const req: BatchRequest = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      input,
      resolve,
      reject,
    }

    batchQueue.push(req)

    if (batchQueue.length >= BATCH_SIZE) {
      if (batchTimer) clearTimeout(batchTimer)
      processBatch()
    } else if (!batchTimer) {
      batchTimer = setTimeout(processBatch, 200)
    }
  })
}

export const adapt: Adapter = async (input: AdapterInput) => {
  try {
    const result = await enqueueBatch(input)
    return result
  } catch (error) {
    const elapsed = Date.now()
    return {
      output: error instanceof Error ? error.message : String(error),
      timing: {
        total: elapsed,
      },
      exitCode: 1,
      timedOut: false,
    }
  }
}
