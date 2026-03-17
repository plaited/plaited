/**
 * Semantic embedding search tool — cosine similarity over hypergraph memory.
 *
 * @remarks
 * Wraps an OpenAI-compatible `/v1/embeddings` endpoint (EmbeddingGemma via
 * MLX or vLLM). Embeds the query, loads JSON-LD vertex files from a memory
 * directory, embeds each snippet, and returns the top-k matches by cosine
 * similarity. Falls back to mock data when no endpoint URL is configured.
 *
 * @public
 */

import { resolve } from 'node:path'
import * as z from 'zod'
import { RISK_TAG } from '../agent/agent.constants.ts'
import type { ToolDefinition } from '../agent/agent.schemas.ts'
import type { ToolContext, ToolHandler } from '../agent/agent.types.ts'

// ============================================================================
// Schemas
// ============================================================================

export const EmbedSearchInputSchema = z.object({
  query: z.string().min(1).describe('Natural language query to search for'),
  memoryDir: z.string().describe('Path to the .memory/ directory to search'),
  topK: z.number().int().min(1).max(50).default(5).describe('Number of results to return'),
})

export const EmbedSearchResultSchema = z.object({
  id: z.string().describe('JSON-LD @id of the matching vertex'),
  snippet: z.string().describe('Relevant text excerpt from the vertex'),
  score: z.number().min(0).max(1).describe('Cosine similarity score (0–1)'),
})

export const EmbedSearchOutputSchema = z.object({
  results: z.array(EmbedSearchResultSchema),
  total: z.number().describe('Total vertices searched'),
})

export type EmbedSearchInput = z.infer<typeof EmbedSearchInputSchema>
export type EmbedSearchOutput = z.infer<typeof EmbedSearchOutputSchema>

// ============================================================================
// Cosine similarity helper
// ============================================================================

const cosineSimilarity = (a: number[], b: number[]): number => {
  if (a.length !== b.length || a.length === 0) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

// ============================================================================
// Embedding backend
// ============================================================================

const fetchEmbedding = async (text: string, url: string, signal: AbortSignal): Promise<number[]> => {
  const response = await fetch(`${url}/v1/embeddings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ input: text, model: 'embedding' }),
    signal,
  })
  if (!response.ok) throw new Error(`Embedding API error: ${response.status} ${response.statusText}`)
  const data = (await response.json()) as { data: Array<{ embedding: number[] }> }
  const embedding = data.data[0]?.embedding
  if (!embedding) throw new Error('Embedding API returned no embedding')
  return embedding
}

// ============================================================================
// Memory loader
// ============================================================================

type JsonLdVertex = {
  '@id'?: string
  '@type'?: string | string[]
  'schema:text'?: string
  'schema:description'?: string
  'schema:name'?: string
  [key: string]: unknown
}

const extractSnippet = (vertex: JsonLdVertex): string => {
  const candidates = [
    vertex['schema:text'],
    vertex['schema:description'],
    vertex['schema:name'],
  ].filter((v): v is string => typeof v === 'string')
  return candidates[0]?.slice(0, 512) ?? JSON.stringify(vertex).slice(0, 256)
}

const loadMemoryVertices = async (memoryDir: string): Promise<Array<{ id: string; snippet: string }>> => {
  const dir = resolve(memoryDir)
  const glob = new Bun.Glob('**/*.jsonld')
  const vertices: Array<{ id: string; snippet: string }> = []

  for await (const path of glob.scan({ cwd: dir })) {
    try {
      const file = Bun.file(`${dir}/${path}`)
      if (!(await file.exists())) continue
      const data = (await file.json()) as JsonLdVertex | JsonLdVertex[]
      const items = Array.isArray(data) ? data : [data]
      for (const item of items) {
        const id = item['@id'] ?? path
        const snippet = extractSnippet(item)
        if (snippet) vertices.push({ id, snippet })
      }
    } catch {
      // Skip malformed files
    }
  }

  return vertices
}

// ============================================================================
// Mock backend
// ============================================================================

const MOCK_RESULTS: EmbedSearchOutput = {
  results: [
    { id: 'mock://vertex/1', snippet: 'Mock search result: agent loop decision', score: 0.92 },
    { id: 'mock://vertex/2', snippet: 'Mock search result: MSS composition pattern', score: 0.87 },
    { id: 'mock://vertex/3', snippet: 'Mock search result: hypergraph memory vertex', score: 0.81 },
  ],
  total: 3,
}

// ============================================================================
// Handler factory
// ============================================================================

/**
 * Create an embed_search tool handler backed by a real or mock embedding endpoint.
 *
 * @param options - `url` for real MLX endpoint; omit for mock mode (tests/dev)
 * @returns ToolHandler callable by the agent executor
 *
 * @public
 */
export const createEmbedSearchHandler = (options: { url?: string } = {}): ToolHandler => {
  return async (rawArgs: Record<string, unknown>, ctx: ToolContext): Promise<EmbedSearchOutput> => {
    const parsed = EmbedSearchInputSchema.safeParse(rawArgs)
    if (!parsed.success) throw new Error(`Invalid embed_search input: ${parsed.error.message}`)
    const { query, memoryDir, topK } = parsed.data

    // Mock mode
    if (!options.url) {
      return {
        results: MOCK_RESULTS.results.slice(0, topK),
        total: MOCK_RESULTS.total,
      }
    }

    // Real mode: embed query, load vertices, rank by cosine similarity
    const queryEmbedding = await fetchEmbedding(query, options.url, ctx.signal)
    const vertices = await loadMemoryVertices(resolve(ctx.workspace, memoryDir))

    if (vertices.length === 0) return { results: [], total: 0 }

    // Embed all vertices and compute similarity
    const scored = await Promise.all(
      vertices.map(async ({ id, snippet }) => {
        const embedding = await fetchEmbedding(snippet, options.url!, ctx.signal)
        return { id, snippet, score: cosineSimilarity(queryEmbedding, embedding) }
      }),
    )

    scored.sort((a, b) => b.score - a.score)
    return {
      results: scored.slice(0, topK),
      total: vertices.length,
    }
  }
}

// ============================================================================
// Tool definition and risk tags
// ============================================================================

/** Risk tags for the embed_search tool */
export const embedSearchRiskTags: string[] = [RISK_TAG.workspace, RISK_TAG.inbound]

/** ToolDefinition for the embed_search tool */
export const embedSearchToolDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'embed_search',
    description:
      'Semantic search over hypergraph memory using cosine similarity on embeddings. ' +
      'Returns the most relevant vertices from .memory/ for a natural language query.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language query' },
        memoryDir: { type: 'string', description: 'Path to .memory/ directory (relative to workspace)' },
        topK: { type: 'number', description: 'Number of results (default: 5, max: 50)' },
      },
      required: ['query', 'memoryDir'],
    },
  },
  tags: embedSearchRiskTags,
}
