import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import type { ToolSchema } from '../agent.types.ts'
import {
  createToolDiscovery,
  extractKeywords,
  filterToolsByIntent,
  schemaToIndexedTool,
  type ToolDiscovery,
} from '../tool-discovery.ts'

// ============================================================================
// Test Fixtures
// ============================================================================

const createTestSchema = (name: string, description: string): ToolSchema => ({
  name,
  description,
  parameters: {
    type: 'object',
    properties: {
      input: { type: 'string', description: 'Input parameter' },
    },
    required: ['input'],
  },
})

const testSchemas: ToolSchema[] = [
  createTestSchema('writeTemplate', 'Write a JSX template file for a UI element'),
  createTestSchema('writeStory', 'Write a story file for testing a template'),
  createTestSchema('runStory', 'Execute a story file and return test results'),
  createTestSchema('listFiles', 'List files in a directory'),
  createTestSchema('searchPatterns', 'Search for patterns matching a query'),
]

// ============================================================================
// extractKeywords Tests
// ============================================================================

describe('extractKeywords', () => {
  test('extracts words from tool name (camelCase)', () => {
    const schema = createTestSchema('writeTemplate', 'Write a file')
    const keywords = extractKeywords(schema)

    expect(keywords).toContain('write')
    expect(keywords).toContain('template')
  })

  test('extracts words from description', () => {
    const schema = createTestSchema('test', 'Write a JSX template file for UI')
    const keywords = extractKeywords(schema)

    expect(keywords).toContain('write')
    expect(keywords).toContain('jsx')
    expect(keywords).toContain('template')
    expect(keywords).toContain('file')
  })

  test('extracts parameter names', () => {
    const schema: ToolSchema = {
      name: 'test',
      description: 'Test tool',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string' },
          content: { type: 'string' },
        },
      },
    }
    const keywords = extractKeywords(schema)

    expect(keywords).toContain('filepath')
    expect(keywords).toContain('content')
  })

  test('deduplicates keywords', () => {
    const schema = createTestSchema('writeFile', 'Write a file to disk')
    const keywords = extractKeywords(schema)

    const fileCount = keywords.filter((k) => k === 'file').length
    expect(fileCount).toBe(1)
  })

  test('filters short words', () => {
    const schema = createTestSchema('test', 'A UI element')
    const keywords = extractKeywords(schema)

    expect(keywords).not.toContain('a')
    expect(keywords).not.toContain('ui')
  })
})

// ============================================================================
// schemaToIndexedTool Tests
// ============================================================================

describe('schemaToIndexedTool', () => {
  test('converts schema to indexed tool with defaults', () => {
    const schema = createTestSchema('writeTemplate', 'Write a template')
    const indexed = schemaToIndexedTool(schema)

    expect(indexed.name).toBe('writeTemplate')
    expect(indexed.description).toBe('Write a template')
    expect(indexed.source).toBe('local')
    expect(indexed.sourceUrl).toBeUndefined()
    expect(indexed.schema).toBe(schema)
    expect(indexed.keywords.length).toBeGreaterThan(0)
  })

  test('accepts source and sourceUrl', () => {
    const schema = createTestSchema('remoteTool', 'A remote tool')
    const indexed = schemaToIndexedTool(schema, 'mcp', 'https://example.com/mcp')

    expect(indexed.source).toBe('mcp')
    expect(indexed.sourceUrl).toBe('https://example.com/mcp')
  })
})

// ============================================================================
// createToolDiscovery Tests (FTS5 only - default)
// ============================================================================

describe('createToolDiscovery (FTS5 only)', () => {
  let discovery: ToolDiscovery

  beforeEach(async () => {
    discovery = await createToolDiscovery()
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('creates empty discovery registry', () => {
    const stats = discovery.stats()

    expect(stats.totalTools).toBe(0)
    expect(stats.localTools).toBe(0)
    expect(stats.mcpTools).toBe(0)
    expect(stats.a2aTools).toBe(0)
    expect(stats.vectorSearchEnabled).toBe(false)
  })

  test('indexes a tool', async () => {
    const tool = schemaToIndexedTool(testSchemas[0]!)
    await discovery.index(tool)

    const stats = discovery.stats()
    expect(stats.totalTools).toBe(1)
    expect(stats.localTools).toBe(1)
  })

  test('indexes multiple tools in batch', async () => {
    const tools = testSchemas.map((s) => schemaToIndexedTool(s))
    await discovery.indexBatch(tools)

    const stats = discovery.stats()
    expect(stats.totalTools).toBe(5)
  })

  test('retrieves all tools', async () => {
    const tools = testSchemas.map((s) => schemaToIndexedTool(s))
    await discovery.indexBatch(tools)

    const all = discovery.all()
    expect(all).toHaveLength(5)
  })

  test('filters by source', async () => {
    await discovery.index(schemaToIndexedTool(testSchemas[0]!, 'local'))
    await discovery.index(schemaToIndexedTool(testSchemas[1]!, 'mcp', 'https://mcp.example.com'))
    await discovery.index(schemaToIndexedTool(testSchemas[2]!, 'a2a', 'https://a2a.example.com'))

    expect(discovery.bySource('local')).toHaveLength(1)
    expect(discovery.bySource('mcp')).toHaveLength(1)
    expect(discovery.bySource('a2a')).toHaveLength(1)
  })

  test('removes a tool', async () => {
    const tools = testSchemas.map((s) => schemaToIndexedTool(s))
    await discovery.indexBatch(tools)

    discovery.remove('writeTemplate')

    expect(discovery.stats().totalTools).toBe(4)
    expect(discovery.all().find((t) => t.name === 'writeTemplate')).toBeUndefined()
  })

  test('clears tools by source', async () => {
    await discovery.index(schemaToIndexedTool(testSchemas[0]!, 'local'))
    await discovery.index(schemaToIndexedTool(testSchemas[1]!, 'mcp'))
    await discovery.index(schemaToIndexedTool(testSchemas[2]!, 'mcp'))

    discovery.clearSource('mcp')

    expect(discovery.stats().totalTools).toBe(1)
    expect(discovery.bySource('mcp')).toHaveLength(0)
    expect(discovery.bySource('local')).toHaveLength(1)
  })
})

// ============================================================================
// FTS5 Search Tests
// ============================================================================

describe('FTS5 search', () => {
  let discovery: ToolDiscovery

  beforeEach(async () => {
    discovery = await createToolDiscovery()
    const tools = testSchemas.map((s) => schemaToIndexedTool(s))
    await discovery.indexBatch(tools)
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('finds tools matching intent keywords', async () => {
    const results = await discovery.search('write a template')

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.tool.name).toBe('writeTemplate')
  })

  test('finds tools matching partial keywords', async () => {
    const results = await discovery.search('story')

    expect(results.length).toBeGreaterThan(0)
    const names = results.map((r) => r.tool.name)
    expect(names).toContain('writeStory')
    expect(names).toContain('runStory')
  })

  test('returns empty for no matches', async () => {
    const results = await discovery.search('xyz123nonexistent')

    expect(results).toHaveLength(0)
  })

  test('respects limit option', async () => {
    const results = await discovery.search('file', { limit: 2 })

    expect(results.length).toBeLessThanOrEqual(2)
  })

  test('filters by source', async () => {
    discovery.clearSource('local')
    await discovery.index(schemaToIndexedTool(testSchemas[0]!, 'local'))
    await discovery.index(schemaToIndexedTool(testSchemas[1]!, 'mcp'))

    const localResults = await discovery.search('write', { source: 'local' })
    const mcpResults = await discovery.search('write', { source: 'mcp' })

    expect(localResults.every((r) => r.tool.source === 'local')).toBe(true)
    expect(mcpResults.every((r) => r.tool.source === 'mcp')).toBe(true)
  })

  test('includes score in results', async () => {
    const results = await discovery.search('write template')

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.score).toBeGreaterThan(0)
    expect(results[0]!.score).toBeLessThanOrEqual(1)
  })

  test('sorts by relevance', async () => {
    const results = await discovery.search('write template file')

    if (results.length > 1) {
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score)
      }
    }
  })
})

// ============================================================================
// filterToolsByIntent Tests
// ============================================================================

describe('filterToolsByIntent', () => {
  let discovery: ToolDiscovery

  beforeEach(async () => {
    discovery = await createToolDiscovery()
    const tools = testSchemas.map((s) => schemaToIndexedTool(s))
    await discovery.indexBatch(tools)
  })

  afterEach(async () => {
    await discovery.close()
  })

  test('returns schemas for matching tools', async () => {
    const schemas = await filterToolsByIntent(discovery, 'write a template', testSchemas)

    expect(schemas.length).toBeGreaterThan(0)
    expect(schemas[0]!.name).toBe('writeTemplate')
  })

  test('falls back to discovery tools when no match', async () => {
    const schemas = await filterToolsByIntent(discovery, 'xyz123nonexistent', testSchemas)

    // Should return tools with 'list' or 'search' in name
    const names = schemas.map((s) => s.name)
    expect(names).toContain('listFiles')
    expect(names).toContain('searchPatterns')
  })

  test('respects options', async () => {
    const schemas = await filterToolsByIntent(discovery, 'write', testSchemas, { limit: 1 })

    expect(schemas).toHaveLength(1)
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  test('handles empty database path', async () => {
    const discovery = await createToolDiscovery({ dbPath: ':memory:' })
    expect(discovery.stats().totalTools).toBe(0)
    await discovery.close()
  })

  test('handles special characters in query', async () => {
    const discovery = await createToolDiscovery()
    const tools = testSchemas.map((s) => schemaToIndexedTool(s))
    await discovery.indexBatch(tools)

    // Should not throw
    const results = await discovery.search('write (template) [file]')
    expect(results.length).toBeGreaterThan(0)

    await discovery.close()
  })

  test('handles duplicate tool names', async () => {
    const discovery = await createToolDiscovery()

    await discovery.index(schemaToIndexedTool(testSchemas[0]!))
    await discovery.index(schemaToIndexedTool(testSchemas[0]!)) // Same tool again

    expect(discovery.stats().totalTools).toBe(1) // Should replace, not duplicate

    await discovery.close()
  })

  test('handles empty intent', async () => {
    const discovery = await createToolDiscovery()
    const tools = testSchemas.map((s) => schemaToIndexedTool(s))
    await discovery.indexBatch(tools)

    const results = await discovery.search('')
    expect(results).toHaveLength(0)

    await discovery.close()
  })
})

// ============================================================================
// Embedder Config Tests
// ============================================================================

describe('embedder config resolution', () => {
  test('embedder: false results in FTS5 only', async () => {
    const discovery = await createToolDiscovery({ embedder: false })
    expect(discovery.stats().vectorSearchEnabled).toBe(false)
    await discovery.close()
  })

  test('embedder: undefined results in FTS5 only', async () => {
    const discovery = await createToolDiscovery({})
    expect(discovery.stats().vectorSearchEnabled).toBe(false)
    await discovery.close()
  })
})

// ============================================================================
// Hybrid Search Tests (requires Ollama)
// ============================================================================

describe('hybrid search (vector + FTS5)', () => {
  let discovery: ToolDiscovery

  beforeAll(async () => {
    discovery = await createToolDiscovery({ embedder: true })
    expect(discovery.stats().vectorSearchEnabled).toBe(true)
    const tools = testSchemas.map((s) => schemaToIndexedTool(s))
    await discovery.indexBatch(tools)
  }, 120000) // 2 min timeout for model loading

  afterAll(async () => {
    await discovery.close()
  })

  test('enables vector search when embedder: true', () => {
    expect(discovery.stats().vectorSearchEnabled).toBe(true)
  })

  test('finds semantically similar tools', async () => {
    // "create UI component" should match "writeTemplate" via semantic similarity
    // even though keywords don't exactly match
    const results = await discovery.search('create UI component')

    expect(results.length).toBeGreaterThan(0)
    // writeTemplate should rank high due to semantic similarity
    const names = results.map((r) => r.tool.name)
    expect(names).toContain('writeTemplate')
  })

  test('includes vectorSimilarity in results', async () => {
    const results = await discovery.search('write a template')

    expect(results.length).toBeGreaterThan(0)
    // At least one result should have vectorSimilarity
    const hasVectorResult = results.some((r) => r.vectorSimilarity !== undefined)
    expect(hasVectorResult).toBe(true)
  })

  test('combines FTS and vector scores', async () => {
    const results = await discovery.search('template file')

    expect(results.length).toBeGreaterThan(0)
    // Results should have combined score from both sources
    expect(results[0]!.score).toBeGreaterThan(0)
  })

  test('respects ftsWeight and vectorWeight options', async () => {
    // FTS-only results (vectorWeight: 0)
    const ftsOnlyResults = await discovery.search('write template', {
      ftsWeight: 1,
      vectorWeight: 0,
    })

    // Vector-only results (ftsWeight: 0)
    const vecOnlyResults = await discovery.search('write template', {
      ftsWeight: 0,
      vectorWeight: 1,
    })

    // Both should return results but potentially in different order
    expect(ftsOnlyResults.length).toBeGreaterThan(0)
    expect(vecOnlyResults.length).toBeGreaterThan(0)
  })
})

// ============================================================================
// Custom Ollama Config Tests
// ============================================================================

describe('custom embedder config', () => {
  test('accepts custom Ollama model configuration', async () => {
    const discovery = await createToolDiscovery({
      embedder: {
        model: 'all-minilm',
        baseUrl: 'http://localhost:11434',
        autoStart: true,
        autoPull: true,
      },
    })

    // vectorSearchEnabled depends on whether Ollama is installed
    // If Ollama is available, this will be true; otherwise false (graceful fallback)
    const stats = discovery.stats()
    expect(typeof stats.vectorSearchEnabled).toBe('boolean')
    discovery.close()
  }, 120000)

  test('gracefully disables vector search when Ollama unavailable', async () => {
    const discovery = await createToolDiscovery({
      embedder: {
        baseUrl: 'http://localhost:99999', // Invalid port
        autoStart: false,
        autoPull: false,
      },
    })

    // Should gracefully fall back to FTS5 only
    expect(discovery.stats().vectorSearchEnabled).toBe(false)
    discovery.close()
  }, 120000)
})
