import { type AgentToolCall, AgentToolCallSchema, type ModelUsage, type ToolDefinition } from './agent.schemas.ts'
import type { ModelResponseDetail, ParsedModelResponse, PrimaryInferenceModel } from './agent.types.ts'

// ============================================================================
// parseModelResponse — extract thinking, tool calls, and message from response
// ============================================================================

const THINK_TAG_REGEX = /^<think>([\s\S]*?)<\/think>\s*/

/**
 * Extracts structured data from a raw model response.
 *
 * @remarks
 * Handles two thinking formats:
 * 1. `reasoning_content` field (vLLM/MLX extension) — preferred
 * 2. `<think>...</think>` XML tags in content — fallback
 *
 * Tool call arguments are JSON-parsed from string form.
 * Used by the inference handler to construct `ParsedModelResponse`
 * from accumulated `ModelDelta` chunks on the `done` event.
 *
 * @param response - Raw inference response (OpenAI-compatible format)
 * @returns Parsed response with thinking, tool calls, and message
 *
 * @public
 */
export const parseModelResponse = (response: {
  choices: Array<{ message: { content?: string | null; tool_calls?: unknown[]; reasoning_content?: string | null } }>
}): ParsedModelResponse => {
  const msg = response.choices[0]?.message
  if (!msg) return { thinking: null, toolCalls: [], message: null }

  // Extract thinking: prefer reasoning_content, fall back to <think> tags
  let thinking: string | null = msg.reasoning_content ?? null
  let content = msg.content ?? null

  if (!thinking && content) {
    const match = content.match(THINK_TAG_REGEX)
    if (match) {
      thinking = match[1]?.trim() ?? null
      content = content.slice(match[0].length) || null
    }
  }

  // Parse tool calls
  const toolCalls: AgentToolCall[] = []
  if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      const raw = tc as { id?: string; function?: { name?: string; arguments?: string } }
      if (raw.id && raw.function?.name) {
        let args: Record<string, unknown> = {}
        if (typeof raw.function.arguments === 'string') {
          try {
            args = JSON.parse(raw.function.arguments)
          } catch {
            args = { _raw: raw.function.arguments }
          }
        } else if (raw.function.arguments && typeof raw.function.arguments === 'object') {
          args = raw.function.arguments as Record<string, unknown>
        }
        const parsedToolCall = AgentToolCallSchema.safeParse({
          id: raw.id,
          name: raw.function.name,
          arguments: args,
        })
        if (parsedToolCall.success) {
          toolCalls.push(parsedToolCall.data)
        }
      }
    }
  }

  // Remaining content is the user-facing message
  const message = content?.trim() || null

  return { thinking, toolCalls, message }
}

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
export const createOpenAICompatModel =
  ({ baseUrl, apiKey, model, defaultTimeout = DEFAULT_TIMEOUT }: OpenAICompatOptions): PrimaryInferenceModel =>
  async ({ messages, tools, temperature, timeout }) => {
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

    const signal = AbortSignal.timeout(timeout ?? defaultTimeout)
    let response: Response | undefined
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      signal.throwIfAborted()
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal,
      })
      if (response.status !== 429 || attempt === MAX_RETRIES) break

      const retryAfter = response.headers.get('retry-after')
      const delay = retryAfter ? Number.parseInt(retryAfter, 10) * 1_000 : INITIAL_BACKOFF_MS * 2 ** attempt
      await new Promise((r) => setTimeout(r, delay))
    }

    if (!response?.ok) {
      const text = await response?.text().catch(() => 'unknown error')
      throw new Error(`${response?.status ?? 'unknown'}: ${text}`)
    }

    if (!response.body) {
      throw new Error('No response body')
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    const usage: ModelUsage = { inputTokens: 0, outputTokens: 0 }
    const toolCallIds = new Map<number, string>()
    let thinking = ''
    let text = ''
    const toolCalls = new Map<string, { id: string; name: string; arguments: string }>()

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
              thinking += delta.reasoning_content
            }
            if (delta.content) {
              text += delta.content
            }
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                if (tc.id) toolCallIds.set(tc.index, tc.id)
                const id = tc.id ?? toolCallIds.get(tc.index) ?? ''
                const existing = toolCalls.get(id)
                if (!existing) {
                  toolCalls.set(id, {
                    id,
                    name: tc.function?.name ?? '',
                    arguments: tc.function?.arguments ?? '',
                  })
                  continue
                }
                if (tc.function?.name) {
                  existing.name = tc.function.name
                }
                if (tc.function?.arguments) {
                  existing.arguments += tc.function.arguments
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

    return {
      parsed: parseModelResponse({
        choices: [
          {
            message: {
              content: text || null,
              reasoning_content: thinking || null,
              tool_calls:
                toolCalls.size > 0
                  ? [...toolCalls.values()].map((toolCall) => ({
                      id: toolCall.id,
                      function: {
                        name: toolCall.name,
                        arguments: toolCall.arguments,
                      },
                    }))
                  : undefined,
            },
          },
        ],
      }),
      usage,
    } satisfies ModelResponseDetail
  }
