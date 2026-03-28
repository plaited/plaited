export type EmbeddingProvider = 'openrouter'

export type EmbedInput = {
  texts: string[]
  model?: string
  provider?: EmbeddingProvider
}

export type EmbedResult = {
  provider: EmbeddingProvider
  model: string
  embeddings: number[][]
}

type OpenRouterEmbeddingsResponse = {
  data?: Array<{
    embedding?: number[]
    index?: number
  }>
  model?: string
  usage?: {
    prompt_tokens?: number
    total_tokens?: number
  }
}

export const DEFAULT_OPENROUTER_EMBEDDING_MODEL = 'google/gemini-embedding-001'

export const buildEmbeddingHeaders = () => {
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

export const normalizeEmbeddingResponse = (payload: OpenRouterEmbeddingsResponse): number[][] => {
  const rows = (payload.data ?? [])
    .slice()
    .sort((left, right) => (left.index ?? 0) - (right.index ?? 0))
    .map((row) => row.embedding ?? [])

  return rows
}

export const embed = async ({
  texts,
  model = DEFAULT_OPENROUTER_EMBEDDING_MODEL,
  provider = 'openrouter',
}: EmbedInput): Promise<EmbedResult> => {
  if (provider !== 'openrouter') {
    throw new Error(`Unsupported embedding provider: ${provider}`)
  }

  if (texts.length === 0) {
    return {
      provider,
      model,
      embeddings: [],
    }
  }

  const baseUrl = process.env.OPENROUTER_BASE_URL?.trim() || 'https://openrouter.ai/api/v1'
  const response = await fetch(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: buildEmbeddingHeaders(),
    body: JSON.stringify({
      model,
      input: texts,
      encoding_format: 'float',
    }),
  })

  const payload = (await response.json()) as OpenRouterEmbeddingsResponse | { error?: { message?: string } }

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

    throw new Error(errorMessage)
  }

  const parsed = payload as OpenRouterEmbeddingsResponse

  return {
    provider,
    model: parsed.model ?? model,
    embeddings: normalizeEmbeddingResponse(parsed),
  }
}
