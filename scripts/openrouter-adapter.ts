import type { Adapter } from '../src/improve.ts'

const OPENROUTER_TIMEOUT_MS = 10 * 60_000
const DEFAULT_OPENROUTER_MODEL = 'google/gemini-3.1-pro-preview'

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

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
  model?: string
  id?: string
}

const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim()

export const extractOpenRouterText = (response: OpenRouterResponse): string => {
  const content = response.choices?.[0]?.message?.content
  if (typeof content === 'string') return content.trim()
  if (Array.isArray(content)) {
    return content
      .flatMap((part) => (part?.type === 'text' && typeof part.text === 'string' ? [part.text] : []))
      .join('\n')
      .trim()
  }
  return ''
}

export const buildOpenRouterHeaders = () => {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY is required')
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  if (process.env.OPENROUTER_HTTP_REFERER) {
    headers['HTTP-Referer'] = process.env.OPENROUTER_HTTP_REFERER
  }
  if (process.env.OPENROUTER_X_TITLE) {
    headers['X-Title'] = process.env.OPENROUTER_X_TITLE
  }

  return headers
}

export const adapt: Adapter = async ({ prompt }) => {
  const model = process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL

  const baseUrl = process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1'
  const text = Array.isArray(prompt) ? prompt.join('\n') : prompt
  const start = Date.now()
  const controller = new AbortController()
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS ?? '') || OPENROUTER_TIMEOUT_MS
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: buildOpenRouterHeaders(),
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: text },
        ],
      }),
    })

    const payload = (await response.json()) as OpenRouterResponse | { error?: { message?: string } }
    clearTimeout(timeout)

    if (!response.ok) {
      const errorMessage =
        typeof payload === 'object' &&
        payload !== null &&
        'error' in payload &&
        payload.error &&
        typeof payload.error === 'object' &&
        typeof payload.error.message === 'string'
          ? payload.error.message
          : `${response.status} ${response.statusText}`

      return {
        output: errorMessage,
        capture: {
          source: 'openrouter-api',
          format: 'chat-completion',
          eventCount: 1,
          messageCount: 0,
          metadata: {
            status: response.status,
            model,
          },
        },
        exitCode: 1,
        timedOut: false,
        timing: { total: Date.now() - start },
      }
    }

    const parsed = payload as OpenRouterResponse
    return {
      output: extractOpenRouterText(parsed),
      capture: {
        source: 'openrouter-api',
        format: 'chat-completion',
        eventCount: 1,
        messageCount: 1,
        snippets: parsed.model ? [{ kind: 'event', text: normalizeText(`model=${parsed.model}`) }] : undefined,
        metadata: {
          model: parsed.model ?? model,
          requestId: parsed.id,
        },
      },
      timing: {
        total: Date.now() - start,
        ...(parsed.usage?.prompt_tokens ? { inputTokens: parsed.usage.prompt_tokens } : {}),
        ...(parsed.usage?.completion_tokens ? { outputTokens: parsed.usage.completion_tokens } : {}),
      },
      exitCode: 0,
      timedOut: false,
    }
  } catch (error) {
    clearTimeout(timeout)
    return {
      output: error instanceof Error ? error.message : String(error),
      capture: {
        source: 'openrouter-api',
        format: 'chat-completion',
        eventCount: 0,
        messageCount: 0,
      },
      timing: {
        total: Date.now() - start,
      },
      exitCode: 1,
      timedOut: error instanceof Error && error.name === 'AbortError',
    }
  }
}
