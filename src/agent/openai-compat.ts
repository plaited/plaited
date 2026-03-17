import type { ModelUsage, ToolDefinition } from './agent.schemas.ts'
import type { Model, ModelDelta } from './agent.types.ts'

/**
 * Configuration for an OpenAI-compatible inference backend.
 *
 * @remarks
 * Works with Ollama, vLLM, llama.cpp, Together AI, OpenRouter, Fireworks,
 * and any backend exposing `/chat/completions` with `stream: true`.
 *
 * @public
 */
export type OpenAICompatOptions = {
  /** Base URL (e.g., "http://localhost:11434/v1" for Ollama) */
  baseUrl: string
  /** API key for authenticated endpoints */
  apiKey?: string
  /** Model identifier (e.g., "falcon-h1r:7b") */
  model: string
  /** Request timeout in milliseconds (default: 120000) */
  defaultTimeout?: number
}

/** Shape of a single SSE chunk from an OpenAI-compatible streaming response */
type OpenAIChunk = {
  choices?: Array<{
    index?: number
    delta?: {
      role?: string
      content?: string | null
      reasoning_content?: string | null
      tool_calls?: Array<{
        index: number
        id?: string
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason?: string | null
  }>
  usage?: { prompt_tokens?: number; completion_tokens?: number }
}

const DEFAULT_TIMEOUT = 120_000
const MAX_RETRIES = 3
const INITIAL_BACKOFF_MS = 1_000

/** Strip `tags` field from tool definitions (not part of OpenAI spec) */
const stripTags = (tools: ToolDefinition[]) => tools.map(({ tags: _, ...rest }) => rest)

/**
 * Creates a Model for any OpenAI-compatible API endpoint.
 *
 * @remarks
 * Handles SSE parsing with `[DONE]` sentinel, `reasoning_content` for
 * thinking (vLLM/DeepSeek extension), streamed tool call accumulation,
 * and 429 retry with exponential backoff (max 3 retries).
 *
 * @public
 */
export const createOpenAICompatModel = ({
  baseUrl,
  apiKey,
  model,
  defaultTimeout = DEFAULT_TIMEOUT,
}: OpenAICompatOptions): Model => ({
  reason: async function* ({ messages, tools, temperature, signal }) {
    const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    const body: Record<string, unknown> = {
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    }
    if (tools?.length) body.tools = stripTags(tools)
    if (temperature !== undefined) body.temperature = temperature

    // ── Fetch with 429 retry ──────────────────────────────────────────
    let response: Response | undefined
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      signal.throwIfAborted()
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.any([signal, AbortSignal.timeout(defaultTimeout)]),
      })
      if (response.status !== 429 || attempt === MAX_RETRIES) break

      const retryAfter = response.headers.get('retry-after')
      const delay = retryAfter ? Number.parseInt(retryAfter, 10) * 1_000 : INITIAL_BACKOFF_MS * 2 ** attempt
      await new Promise((r) => setTimeout(r, delay))
    }

    if (!response?.ok) {
      const text = await response?.text().catch(() => 'unknown error')
      yield { type: 'error', error: `${response?.status ?? 'unknown'}: ${text}` } as ModelDelta
      return
    }

    if (!response.body) {
      yield { type: 'error', error: 'No response body' } as ModelDelta
      return
    }

    // ── Parse SSE stream ──────────────────────────────────────────────
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const usage: ModelUsage = { inputTokens: 0, outputTokens: 0 }
    /** Track streamed tool call index → id (first chunk carries id, subsequent don't) */
    const toolCallIds = new Map<number, string>()

    try {
      while (true) {
        signal.throwIfAborted()
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        buffer = buffer.replaceAll('\r\n', '\n').replaceAll('\r', '\n')

        let frameEnd = buffer.indexOf('\n\n')
        while (frameEnd !== -1) {
          const frame = buffer.slice(0, frameEnd)
          buffer = buffer.slice(frameEnd + 2)

          for (const line of frame.split('\n')) {
            const data = line.startsWith('data: ') ? line.slice(6) : line.startsWith('data:') ? line.slice(5) : null
            if (!data?.trim() || data.trim() === '[DONE]') continue

            let chunk: OpenAIChunk
            try {
              chunk = JSON.parse(data)
            } catch {
              continue
            }

            if (chunk.usage) {
              usage.inputTokens = chunk.usage.prompt_tokens ?? 0
              usage.outputTokens = chunk.usage.completion_tokens ?? 0
            }

            const choice = chunk.choices?.[0]
            if (!choice?.delta) continue
            const { delta } = choice

            if (delta.reasoning_content) {
              yield { type: 'thinking_delta', content: delta.reasoning_content }
            }
            if (delta.content) {
              yield { type: 'text_delta', content: delta.content }
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.id) toolCallIds.set(tc.index, tc.id)
                const id = tc.id ?? toolCallIds.get(tc.index) ?? ''
                yield {
                  type: 'toolcall_delta',
                  id,
                  ...(tc.function?.name && { name: tc.function.name }),
                  ...(tc.function?.arguments && { arguments: tc.function.arguments }),
                }
              }
            }
          }
          frameEnd = buffer.indexOf('\n\n')
        }
      }
    } finally {
      reader.releaseLock()
    }

    yield { type: 'done', response: { usage } }
  },
})
