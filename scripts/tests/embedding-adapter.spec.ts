import { describe, expect, test } from 'bun:test'
import {
  buildEmbeddingHeaders,
  DEFAULT_OPENROUTER_EMBEDDING_MODEL,
  normalizeEmbeddingResponse,
} from '../embedding-adapter.ts'

describe('embedding-adapter', () => {
  test('builds auth headers from env', () => {
    process.env.OPENROUTER_API_KEY = 'test-key'

    const headers = buildEmbeddingHeaders()

    expect(headers.Authorization).toBe('Bearer test-key')
    expect(headers['Content-Type']).toBe('application/json')
  })

  test('uses the expected default model constant', () => {
    expect(DEFAULT_OPENROUTER_EMBEDDING_MODEL).toBe('google/gemini-embedding-001')
  })

  test('normalizes and sorts embedding rows by index', () => {
    const embeddings = normalizeEmbeddingResponse({
      data: [
        { index: 1, embedding: [3, 4] },
        { index: 0, embedding: [1, 2] },
      ],
    })

    expect(embeddings).toEqual([
      [1, 2],
      [3, 4],
    ])
  })
})
