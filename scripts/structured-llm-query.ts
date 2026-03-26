import { extractFirstJsonObject, extractTaggedJsonObject } from './json-extract.ts'
import { buildOpenRouterHeaders, extractOpenRouterText } from './openrouter-adapter.ts'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
const DEFAULT_PRIMARY_JUDGE_MODEL = 'z-ai/glm-5'
const DEFAULT_META_VERIFIER_MODEL = 'minimax/minimax-m2.5'
const DEFAULT_VALIDATION_RETRIES = 2
const DEFAULT_JSON_SYSTEM_PROMPT =
  'Return only a single JSON object that satisfies the user request. Do not include markdown fences or commentary.'

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: string | Array<{ type?: string; text?: string }>
    }
  }>
  usage?: {
    cost?: number
    prompt_tokens?: number
    completion_tokens?: number
  }
  model?: string
}

export const extractStructuredJsonObject = (value: string): string => {
  const fenced = value.match(/```json\s*([\s\S]*?)```/u)
  if (fenced?.[1]) return fenced[1].trim()
  const tagged = extractTaggedJsonObject({
    text: value,
    tag: 'json',
  })
  if (tagged) return tagged
  const objectMatch = extractFirstJsonObject(value)
  if (objectMatch) return objectMatch
  throw new Error('No JSON object found in model output')
}

export const resolvePrimaryJudgeModel = (): string =>
  process.env.PLAITED_PRIMARY_JUDGE_MODEL?.trim() || DEFAULT_PRIMARY_JUDGE_MODEL

export const resolveMetaVerifierModel = (): string =>
  process.env.PLAITED_META_VERIFIER_MODEL?.trim() || DEFAULT_META_VERIFIER_MODEL

export const runStructuredLlmQuery = async <T>({
  model,
  prompt,
  schema,
  systemPrompt = DEFAULT_JSON_SYSTEM_PROMPT,
  validationRetries = DEFAULT_VALIDATION_RETRIES,
}: {
  model: string
  prompt: string
  schema: unknown
  systemPrompt?: string
  validationRetries?: number
}): Promise<
  { ok: true; value: T; meta?: Record<string, unknown> } | { ok: false; reason: string; meta?: Record<string, unknown> }
> => {
  let attempt = 0

  while (attempt <= validationRetries) {
    try {
      const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: buildOpenRouterHeaders(),
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: {
              name: 'plaited_structured_output',
              strict: true,
              schema,
            },
          },
        }),
      })

      const payload = (await response.json()) as OpenRouterResponse & { error?: { message?: string } }
      if (!response.ok) {
        const message =
          typeof payload.error?.message === 'string'
            ? payload.error.message
            : `${response.status} ${response.statusText}`
        return {
          ok: false,
          reason: message,
          meta: {
            source: 'openrouter-api',
            model,
            status: response.status,
            attempt: attempt + 1,
          },
        }
      }

      const text = extractOpenRouterText(payload)
      return {
        ok: true,
        value: JSON.parse(extractStructuredJsonObject(text)) as T,
        meta: {
          source: 'openrouter-api',
          model: payload.model ?? model,
          totalCostUsd: typeof payload.usage?.cost === 'number' ? payload.usage.cost : 0,
          usage: {
            promptTokens: payload.usage?.prompt_tokens ?? 0,
            completionTokens: payload.usage?.completion_tokens ?? 0,
          },
          attempt: attempt + 1,
        },
      }
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      const shouldRetry =
        attempt < validationRetries &&
        (reason.includes('No JSON object found') ||
          reason.includes('Unexpected token') ||
          reason.includes('JSON') ||
          reason.includes('Invalid input'))

      if (shouldRetry) {
        attempt += 1
        continue
      }

      return {
        ok: false,
        reason,
        meta: {
          source: 'openrouter-api',
          model,
          attempt: attempt + 1,
        },
      }
    }
  }

  return {
    ok: false,
    reason: 'Structured LLM query exhausted validation retries.',
    meta: {
      source: 'openrouter-api',
      model,
      attempt: validationRetries + 1,
    },
  }
}
