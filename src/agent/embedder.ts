/**
 * Shared embedder utilities for vector-based search.
 *
 * @remarks
 * Provides in-process text embeddings using node-llama-cpp with GGUF models.
 * Used by semantic-cache and tool-discovery for similarity search.
 *
 * **Model Management:**
 * - Models auto-download from Hugging Face on first use
 * - Default: EmbeddingGemma-300m (Q8_0, ~329MB, 768 dimensions)
 * - Supports 100+ languages with state-of-the-art MTEB scores
 * - Cached in `~/.cache/plaited/models` by default
 *
 * **Graceful Degradation:**
 * - If model loading fails, `createEmbedder` returns `undefined`
 * - Callers should check the return value and fall back gracefully
 *
 * @module
 */

import { homedir } from 'node:os'
import { join } from 'node:path'
import { createModelDownloader, getLlama, type LlamaEmbeddingContext, type LlamaModel } from 'node-llama-cpp'
import type { EmbedderConfig } from './agent.types.ts'

// ============================================================================
// Constants
// ============================================================================

/** Default Hugging Face model URI for embeddings (EmbeddingGemma-300m, 100+ languages) */
export const DEFAULT_MODEL_URI = 'hf:ggml-org/embeddinggemma-300M-GGUF:Q8_0'

/** Default directory for cached models */
export const DEFAULT_MODELS_DIR = join(homedir(), '.cache', 'plaited', 'models')

// ============================================================================
// Types
// ============================================================================

/**
 * Embedder instance with embed function and cleanup.
 */
export type Embedder = {
  /** Generate embedding vector for text */
  embed: (text: string) => Promise<readonly number[]>
  /** Embedding vector dimensions */
  dimensions: number
  /** Clean up resources */
  dispose: () => Promise<void>
}

// ============================================================================
// Vector Math
// ============================================================================

/**
 * Computes cosine similarity between two vectors.
 *
 * @param a - First vector
 * @param b - Second vector
 * @returns Similarity score between -1 and 1 (1 = identical)
 */
export const cosineSimilarity = (a: readonly number[], b: readonly number[]): number => {
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * Finds top-k most similar vectors using linear search.
 *
 * @param options - Search options
 * @returns Array of matches sorted by similarity descending
 */
export const findTopSimilar = ({
  query,
  embeddings,
  limit,
}: {
  /** Query embedding vector */
  query: readonly number[]
  /** Map of rowid to embedding vectors */
  embeddings: Map<number, readonly number[]>
  /** Maximum number of results */
  limit: number
}): Array<{ rowid: number; similarity: number }> => {
  const results: Array<{ rowid: number; similarity: number }> = []

  for (const [rowid, embedding] of embeddings) {
    const similarity = cosineSimilarity(query, embedding)
    results.push({ rowid, similarity })
  }

  // Sort by similarity descending and take top k
  return results.sort((a, b) => b.similarity - a.similarity).slice(0, limit)
}

// ============================================================================
// Embedder Factory
// ============================================================================

/**
 * Creates an embedder using node-llama-cpp.
 *
 * @param config - Embedder configuration
 * @returns Promise resolving to embedder instance, or `undefined` if model loading fails
 *
 * @remarks
 * Loads GGUF model in-process. Downloads from Hugging Face if needed.
 * Returns `undefined` if model loading fails, allowing callers to
 * gracefully degrade (e.g., fall back to FTS-only search).
 */
export const createEmbedder = async (config: EmbedderConfig = {}): Promise<Embedder | undefined> => {
  const { modelUri = DEFAULT_MODEL_URI, modelsDir = DEFAULT_MODELS_DIR } = config

  let model: LlamaModel
  let context: LlamaEmbeddingContext

  try {
    // Ensure models directory exists
    await Bun.write(join(modelsDir, '.gitkeep'), '')

    // Download model if needed (handles HF URIs and caching)
    const downloader = await createModelDownloader({
      modelUri,
      dirPath: modelsDir,
    })

    const modelPath = await downloader.download()

    // Initialize llama.cpp
    const llama = await getLlama()
    model = await llama.loadModel({ modelPath })
    context = await model.createEmbeddingContext()

    // Get dimensions from test embedding
    const testEmbedding = await context.getEmbeddingFor('test')
    const dimensions = testEmbedding.vector.length

    const embed = async (text: string): Promise<readonly number[]> => {
      const embedding = await context.getEmbeddingFor(text)
      return embedding.vector
    }

    const dispose = async () => {
      await context.dispose()
      await model.dispose()
    }

    return { embed, dimensions, dispose }
  } catch (error) {
    console.error('Failed to initialize embedder:', error)
    return undefined
  }
}
