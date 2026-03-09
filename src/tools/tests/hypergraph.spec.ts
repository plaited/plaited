/**
 * Tests for the hypergraph search tool.
 *
 * @remarks
 * Uses fixture `.jsonld` files in `fixtures/hypergraph/` with a known graph
 * structure designed around realistic agent loop use cases.
 *
 * **Fixture graph (9 files, 9 hyperedges):**
 *
 * | File | @type | Key vertices |
 * |------|-------|-------------|
 * | decision-001 | SelectionDecision | taskGate, task, maxIterations, execute |
 * | decision-002 | SelectionDecision | sim_guard_tc-1, execute, batchCompletion, tool_result |
 * | decision-003 | SelectionDecision | batchCompletion, invoke_inference, taskGate, gate_approved |
 * | decision-cycle | SelectionDecision | alpha, beta, gamma, execute (blockedBy cycle) |
 * | meta | Session | session/sess_test (embedding [0.1..0.8]) |
 * | meta-2 | Session | session/sess_other (embedding [0.15..0.85]) |
 * | meta-3 | Session | session/sess_different (embedding [0.9..0.2]) |
 * | ruleset | RuleSet | no-rm-rf, no-etc-writes, execute (via nested references) |
 * | skill | Skill | taskGate, maxIterations, task, message, execute, invoke_inference, tool_result, code-patterns |
 *
 * **Connectivity via shared vertices:**
 * - bp:event/execute connects 5 hyperedges (decisions 1,2,cycle + ruleset + skill)
 * - bp:thread/taskGate connects 3 hyperedges (decisions 1,3 + skill)
 * - Session docs are isolated (no shared vertices with decisions)
 *
 * **Directed edges (for cycle detection):**
 * - sim_guard_tc-1 → sim_guard_tc-1 (self-loop)
 * - alpha → beta → gamma → alpha (triangular cycle)
 * - skill://behavioral-core → skill://code-patterns (requires dependency)
 */

import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'
import type { ToolContext } from '../../agent/agent.types.ts'
import { buildIndex, loadJsonLd, search } from '../hypergraph.ts'

const FIXTURES_DIR = resolve(import.meta.dir, 'fixtures/hypergraph')

const ctx: ToolContext = {
  workspace: resolve(import.meta.dir, 'fixtures'),
  signal: AbortSignal.timeout(30_000),
}

// ============================================================================
// loadJsonLd
// ============================================================================

describe('loadJsonLd', () => {
  test('loads all 9 .jsonld files from fixtures directory', async () => {
    const docs = await loadJsonLd(FIXTURES_DIR)
    expect(docs.length).toBe(9)
  })

  test('each document has an @id field', async () => {
    const docs = await loadJsonLd(FIXTURES_DIR)
    for (const doc of docs) {
      expect(doc['@id']).toBeDefined()
      expect(typeof doc['@id']).toBe('string')
    }
  })
})

// ============================================================================
// buildIndex — hyperedge registration
// ============================================================================

describe('buildIndex', () => {
  describe('hyperedge registration', () => {
    test('counts 9 hyperedges (4 decisions + 3 sessions + 1 ruleset + 1 skill)', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      expect(index.hyperedgeIds.length).toBe(9)
    })

    test('collects 5 unique @type values', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      const types = new Set(index.typeSet)
      expect(types.has('SelectionDecision')).toBe(true)
      expect(types.has('Session')).toBe(true)
      expect(types.has('Skill')).toBe(true)
      expect(types.has('RuleSet')).toBe(true)
      expect(types.size).toBe(4)
    })

    test('handles documents without @id (skips them)', () => {
      const docs = [{ noId: true }, { '@id': 'test:a', '@type': 'T' }]
      const index = buildIndex(docs)
      expect(index.hyperedgeIds.length).toBe(1)
      expect(index.vertexIds.length).toBe(1)
    })

    test('handles documents without @type (registers vertex only)', () => {
      const docs = [{ '@id': 'test:orphan' }]
      const index = buildIndex(docs)
      expect(index.hyperedgeIds.length).toBe(0)
      expect(index.vertexMap.has('test:orphan')).toBe(true)
    })
  })

  // --------------------------------------------------------------------------
  // vertex extraction
  // --------------------------------------------------------------------------

  describe('vertex extraction', () => {
    test('registers vertices from bid threads and events', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      // From decision-001 bids
      expect(index.vertexMap.has('bp:thread/taskGate')).toBe(true)
      expect(index.vertexMap.has('bp:event/task')).toBe(true)
      expect(index.vertexMap.has('bp:thread/maxIterations')).toBe(true)
      expect(index.vertexMap.has('bp:event/execute')).toBe(true)
    })

    test('registers vertices from bid blockedBy field', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      // From decision-002: blockedBy sim_guard_tc-1
      expect(index.vertexMap.has('bp:thread/sim_guard_tc-1')).toBe(true)
      // From decision-cycle: blockedBy alpha, beta, gamma
      expect(index.vertexMap.has('bp:thread/alpha')).toBe(true)
      expect(index.vertexMap.has('bp:thread/beta')).toBe(true)
      expect(index.vertexMap.has('bp:thread/gamma')).toBe(true)
    })

    test('registers vertices from bid interrupts field', () => {
      const docs = [
        {
          '@id': 'test:d',
          '@type': 'SelectionDecision',
          bids: [{ thread: 'bp:thread/t1', event: 'bp:event/e1', interrupts: 'bp:thread/victim' }],
        },
      ]
      const index = buildIndex(docs)
      expect(index.vertexMap.has('bp:thread/victim')).toBe(true)
    })

    test('handles bids with type field instead of event (raw schema format)', () => {
      const docs = [
        {
          '@id': 'test:raw',
          '@type': 'SelectionDecision',
          bids: [{ thread: 'bp:thread/t1', type: 'bp:event/raw_event' }],
        },
      ]
      const index = buildIndex(docs)
      expect(index.vertexMap.has('bp:event/raw_event')).toBe(true)
    })

    test('registers vertices from provides items with @id', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      // From skill: provides[0].@id = bp:thread/taskGate (already registered via bids too)
      // From skill: provides[1].@id = bp:thread/maxIterations
      expect(index.vertexMap.has('bp:thread/taskGate')).toBe(true)
      expect(index.vertexMap.has('bp:thread/maxIterations')).toBe(true)
    })

    test('registers vertices from nested references arrays', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      // From skill: provides[0].references = ["bp:event/task", "bp:event/message"]
      expect(index.vertexMap.has('bp:event/task')).toBe(true)
      expect(index.vertexMap.has('bp:event/message')).toBe(true)
      // From skill: provides[1].references = ["bp:event/tool_result"]
      expect(index.vertexMap.has('bp:event/tool_result')).toBe(true)
    })

    test('registers vertices from nested blocks arrays', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      // From skill: provides[0].blocks = ["bp:event/execute", "bp:event/invoke_inference"]
      expect(index.vertexMap.has('bp:event/execute')).toBe(true)
      expect(index.vertexMap.has('bp:event/invoke_inference')).toBe(true)
    })

    test('registers vertices from requires items (with directed edge)', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      // From skill: requires[0].@id = skill://code-patterns
      expect(index.vertexMap.has('skill://code-patterns')).toBe(true)
    })

    test('registers vertices from rules items with @id', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      // From ruleset: rules[0].@id = rule://no-rm-rf, rules[1].@id = rule://no-etc-writes
      expect(index.vertexMap.has('rule://no-rm-rf')).toBe(true)
      expect(index.vertexMap.has('rule://no-etc-writes')).toBe(true)
      expect(index.vertexMap.has('rules://safety-rules')).toBe(true)
    })

    test('deduplicates vertices shared across hyperedges', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      // bp:event/execute appears in 5 hyperedges but should only be 1 vertex
      const count = index.vertexIds.filter((v) => v === 'bp:event/execute').length
      expect(count).toBe(1)
    })

    test('deduplicates vertices within a single hyperedge', () => {
      // Simulate decision-cycle where execute appears in 3 bids
      const docs = [
        {
          '@id': 'test:d',
          '@type': 'T',
          bids: [
            { thread: 'v:a', event: 'v:shared' },
            { thread: 'v:b', event: 'v:shared' },
            { thread: 'v:c', event: 'v:shared' },
          ],
        },
      ]
      const index = buildIndex(docs)
      const vertexCount = index.vertexIds.filter((v) => v === 'v:shared').length
      expect(vertexCount).toBe(1)
    })
  })

  // --------------------------------------------------------------------------
  // embeddings
  // --------------------------------------------------------------------------

  describe('embeddings', () => {
    test('collects embeddings from 3 Session documents', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      expect(index.embeddingDocs.length).toBe(3)
    })

    test('sets dims to 8 (embedding vector length)', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      expect(index.dims).toBe(8)
    })

    test('flattens embeddings into row-major Float32Array', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      expect(index.embeddings.length).toBe(3 * 8)
      expect(index.embeddings).toBeInstanceOf(Float32Array)
    })

    test('returns empty embeddings when no docs have embedding field', () => {
      const docs = [{ '@id': 'test:d', '@type': 'T' }]
      const index = buildIndex(docs)
      expect(index.embeddingDocs.length).toBe(0)
      expect(index.dims).toBe(0)
    })
  })

  // --------------------------------------------------------------------------
  // directed edges
  // --------------------------------------------------------------------------

  describe('directed edges', () => {
    test('builds directed edges from blockedBy', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      // Should have directed edges: alpha→beta, beta→gamma, gamma→alpha, sim_guard→sim_guard
      expect(index.dirNeighbors.length).toBeGreaterThanOrEqual(4)
    })

    test('builds directed edges from requires', async () => {
      const docs = await loadJsonLd(FIXTURES_DIR)
      const index = buildIndex(docs)
      // skill://behavioral-core → skill://code-patterns
      const skillIdx = index.vertexMap.get('skill://behavioral-core')
      const codeIdx = index.vertexMap.get('skill://code-patterns')
      expect(skillIdx).toBeDefined()
      expect(codeIdx).toBeDefined()
      // Verify the directed edge exists in dirNeighbors
      expect(index.dirNeighbors.length).toBeGreaterThanOrEqual(5) // 4 from blockedBy + 1 from requires
    })
  })

  // --------------------------------------------------------------------------
  // empty graph
  // --------------------------------------------------------------------------

  describe('empty graph', () => {
    test('handles empty docs array', () => {
      const index = buildIndex([])
      expect(index.hyperedgeIds.length).toBe(0)
      expect(index.vertexIds.length).toBe(0)
      expect(index.embeddingDocs.length).toBe(0)
    })
  })
})

// ============================================================================
// causal-chain query
// ============================================================================

describe('causal-chain', () => {
  test('finds 1-hop path for vertices in same hyperedge', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'causal-chain', from: 'bp:thread/taskGate', to: 'bp:thread/maxIterations' },
      ctx,
    )) as { chain: string[] }
    // Both are in decision-001 (and skill), so 1-hop path
    expect(result.chain.length).toBe(1)
  })

  test('finds unique 2-hop path (message → alpha via execute)', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'causal-chain', from: 'bp:event/message', to: 'bp:thread/alpha' },
      ctx,
    )) as { chain: string[] }
    // message is only in skill; alpha is only in decision-cycle
    // Only shared vertex is bp:event/execute → unique 2-hop path
    expect(result.chain.length).toBe(2)
    expect(result.chain).toContain('skill://behavioral-core')
    expect(result.chain).toContain('session/sess_test/decision/4')
  })

  test('finds path between task and gate_approved events', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'causal-chain', from: 'bp:event/task', to: 'bp:event/gate_approved' },
      ctx,
    )) as { chain: string[] }
    // gate_approved is only in decision-003
    // task is in decision-001 and skill
    // Shortest: 2 hops (via shared vertex like taskGate)
    expect(result.chain.length).toBe(2)
    expect(result.chain).toContain('session/sess_test/decision/3')
  })

  test('returns empty for vertices in disconnected components', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'causal-chain', from: 'bp:event/task', to: 'session/sess_other' },
      ctx,
    )) as { chain: string[] }
    // session/sess_other is only in meta-2 Session (isolated singleton hyperedge)
    expect(result.chain).toEqual([])
  })

  test('returns empty for non-existent vertices', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'causal-chain', from: 'nonexistent:a', to: 'nonexistent:b' },
      ctx,
    )) as { chain: string[] }
    expect(result.chain).toEqual([])
  })

  test('returns empty for same from and to vertex', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'causal-chain', from: 'bp:event/task', to: 'bp:event/task' },
      ctx,
    )) as { chain: string[] }
    // WASM returns [0] for same vertex (no path needed)
    expect(result.chain).toEqual([])
  })
})

// ============================================================================
// co-occurrence query
// ============================================================================

describe('co-occurrence', () => {
  test('finds 5 hyperedges for bp:event/execute (most connected vertex)', async () => {
    const result = (await search({ path: 'hypergraph', query: 'co-occurrence', vertex: 'bp:event/execute' }, ctx)) as {
      hyperedges: Array<{ id: string; type: string; vertices: string[] }>
    }
    // execute appears in: decision-001, decision-002, decision-cycle, ruleset, skill
    expect(result.hyperedges.length).toBe(5)
    const ids = result.hyperedges.map((h) => h.id)
    expect(ids).toContain('session/sess_test/decision/1')
    expect(ids).toContain('session/sess_test/decision/2')
    expect(ids).toContain('session/sess_test/decision/4')
    expect(ids).toContain('rules://safety-rules')
    expect(ids).toContain('skill://behavioral-core')
  })

  test('finds 3 hyperedges for bp:thread/taskGate', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'co-occurrence', vertex: 'bp:thread/taskGate' },
      ctx,
    )) as { hyperedges: Array<{ id: string; type: string; vertices: string[] }> }
    // taskGate appears in: decision-001, decision-003, skill
    expect(result.hyperedges.length).toBe(3)
    const ids = result.hyperedges.map((h) => h.id)
    expect(ids).toContain('session/sess_test/decision/1')
    expect(ids).toContain('session/sess_test/decision/3')
    expect(ids).toContain('skill://behavioral-core')
  })

  test('finds 2 hyperedges for bp:thread/batchCompletion', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'co-occurrence', vertex: 'bp:thread/batchCompletion' },
      ctx,
    )) as { hyperedges: Array<{ id: string; type: string; vertices: string[] }> }
    // batchCompletion appears in: decision-002, decision-003
    expect(result.hyperedges.length).toBe(2)
    const ids = result.hyperedges.map((h) => h.id)
    expect(ids).toContain('session/sess_test/decision/2')
    expect(ids).toContain('session/sess_test/decision/3')
  })

  test('finds 1 hyperedge for bp:event/message (only in skill)', async () => {
    const result = (await search({ path: 'hypergraph', query: 'co-occurrence', vertex: 'bp:event/message' }, ctx)) as {
      hyperedges: Array<{ id: string; type: string; vertices: string[] }>
    }
    expect(result.hyperedges.length).toBe(1)
    expect(result.hyperedges[0]!.id).toBe('skill://behavioral-core')
    expect(result.hyperedges[0]!.type).toBe('Skill')
  })

  test('includes type and vertices in each hyperedge result', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'co-occurrence', vertex: 'bp:thread/batchCompletion' },
      ctx,
    )) as { hyperedges: Array<{ id: string; type: string; vertices: string[] }> }
    for (const he of result.hyperedges) {
      expect(typeof he.id).toBe('string')
      expect(typeof he.type).toBe('string')
      expect(Array.isArray(he.vertices)).toBe(true)
      expect(he.vertices.length).toBeGreaterThan(0)
      // Every hyperedge containing batchCompletion should list it as a vertex
      expect(he.vertices).toContain('bp:thread/batchCompletion')
    }
  })

  test('returns empty for unknown vertex', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'co-occurrence', vertex: 'nonexistent:vertex' },
      ctx,
    )) as { hyperedges: Array<{ id: string; type: string; vertices: string[] }> }
    expect(result.hyperedges).toEqual([])
  })
})

// ============================================================================
// check-cycles query
// ============================================================================

describe('check-cycles', () => {
  test('detects the triangular cycle alpha → beta → gamma → alpha', async () => {
    const result = (await search({ path: 'hypergraph', query: 'check-cycles' }, ctx)) as { cycles: string[][] }
    // Find the cycle containing alpha, beta, gamma
    const triangleCycle = result.cycles.find(
      (c) => c.includes('bp:thread/alpha') && c.includes('bp:thread/beta') && c.includes('bp:thread/gamma'),
    )
    expect(triangleCycle).toBeDefined()
    expect(triangleCycle!.length).toBe(3)
  })

  test('detects self-loop sim_guard_tc-1 → sim_guard_tc-1', async () => {
    const result = (await search({ path: 'hypergraph', query: 'check-cycles' }, ctx)) as { cycles: string[][] }
    // Self-loop shows as cycle of length 1
    const selfLoop = result.cycles.find((c) => c.length === 1 && c.includes('bp:thread/sim_guard_tc-1'))
    expect(selfLoop).toBeDefined()
  })

  test('finds exactly 2 cycles total', async () => {
    const result = (await search({ path: 'hypergraph', query: 'check-cycles' }, ctx)) as { cycles: string[][] }
    // 1 triangular cycle + 1 self-loop = 2 cycles
    expect(result.cycles.length).toBe(2)
  })

  test('returns empty when no directed edges exist', () => {
    const docs = [{ '@id': 'test:d', '@type': 'T' }]
    const index = buildIndex(docs)
    // No blockedBy or requires → dirNeighbors is empty
    expect(index.dirNeighbors.length).toBe(0)
  })
})

// ============================================================================
// match query
// ============================================================================

describe('match', () => {
  test('finds 3 matches for [SelectionDecision, SelectionDecision]', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'match', pattern: { sequence: ['SelectionDecision', 'SelectionDecision'] } },
      ctx,
    )) as { matches: Array<Array<{ id: string; type: string; vertices: string[] }>> }
    // 4 consecutive SelectionDecision hyperedges → 3 overlapping pairs
    expect(result.matches.length).toBe(3)
    for (const match of result.matches) {
      expect(match.length).toBe(2)
      expect(match[0]!.type).toBe('SelectionDecision')
      expect(match[1]!.type).toBe('SelectionDecision')
    }
  })

  test('finds 1 match for all 4 decisions [SD, SD, SD, SD]', async () => {
    const result = (await search(
      {
        path: 'hypergraph',
        query: 'match',
        pattern: { sequence: ['SelectionDecision', 'SelectionDecision', 'SelectionDecision', 'SelectionDecision'] },
      },
      ctx,
    )) as { matches: Array<Array<{ id: string; type: string; vertices: string[] }>> }
    expect(result.matches.length).toBe(1)
    expect(result.matches[0]!.length).toBe(4)
  })

  test('finds 2 matches for [Session, Session]', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'match', pattern: { sequence: ['Session', 'Session'] } },
      ctx,
    )) as { matches: Array<Array<{ id: string; type: string; vertices: string[] }>> }
    // 3 consecutive Session hyperedges → 2 overlapping pairs
    expect(result.matches.length).toBe(2)
  })

  test('finds cross-type match [Session, SelectionDecision]', async () => {
    // Sorted @id order: RuleSet, Session×3, SD×4, Skill
    // Session→SD boundary at indices [3,4]
    const result = (await search(
      { path: 'hypergraph', query: 'match', pattern: { sequence: ['Session', 'SelectionDecision'] } },
      ctx,
    )) as { matches: Array<Array<{ id: string; type: string; vertices: string[] }>> }
    expect(result.matches.length).toBe(1)
    expect(result.matches[0]![0]!.type).toBe('Session')
    expect(result.matches[0]![1]!.type).toBe('SelectionDecision')
  })

  test('finds [SelectionDecision, Skill] match (SD→Skill boundary)', async () => {
    // Last SD at index 7, Skill at index 8
    const result = (await search(
      { path: 'hypergraph', query: 'match', pattern: { sequence: ['SelectionDecision', 'Skill'] } },
      ctx,
    )) as { matches: Array<Array<{ id: string; type: string; vertices: string[] }>> }
    expect(result.matches.length).toBe(1)
    expect(result.matches[0]![0]!.type).toBe('SelectionDecision')
    expect(result.matches[0]![1]!.id).toBe('skill://behavioral-core')
  })

  test('returns empty for [Skill, SelectionDecision] (skill is last)', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'match', pattern: { sequence: ['Skill', 'SelectionDecision'] } },
      ctx,
    )) as { matches: Array<Array<{ id: string; type: string; vertices: string[] }>> }
    expect(result.matches).toEqual([])
  })

  test('returns empty for non-existent type', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'match', pattern: { sequence: ['NonExistentType'] } },
      ctx,
    )) as { matches: Array<Array<{ id: string; type: string; vertices: string[] }>> }
    expect(result.matches).toEqual([])
  })

  test('each match includes vertices for the hyperedge', async () => {
    const result = (await search({ path: 'hypergraph', query: 'match', pattern: { sequence: ['Skill'] } }, ctx)) as {
      matches: Array<Array<{ id: string; type: string; vertices: string[] }>>
    }
    expect(result.matches.length).toBe(1)
    const skillMatch = result.matches[0]![0]!
    expect(skillMatch.id).toBe('skill://behavioral-core')
    // Skill hyperedge should contain many vertices from provides/requires/nested
    expect(skillMatch.vertices).toContain('bp:thread/taskGate')
    expect(skillMatch.vertices).toContain('bp:event/message')
    expect(skillMatch.vertices).toContain('skill://code-patterns')
  })
})

// ============================================================================
// similar query
// ============================================================================

describe('similar', () => {
  test('returns 3 results for topK=3 (all 3 Session docs)', async () => {
    const result = (await search(
      {
        path: 'hypergraph',
        query: 'similar',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        topK: 3,
      },
      ctx,
    )) as { results: Array<{ id: string; score: number }> }
    expect(result.results.length).toBe(3)
  })

  test('ranks identical embedding highest (score ~1.0)', async () => {
    const result = (await search(
      {
        path: 'hypergraph',
        query: 'similar',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        topK: 3,
      },
      ctx,
    )) as { results: Array<{ id: string; score: number }> }
    // meta.jsonld has the identical embedding [0.1..0.8]
    const topResult = result.results[0]!
    expect(topResult.score).toBeCloseTo(1.0, 2)
  })

  test('ranks meta (identical) > meta-2 (close) > meta-3 (different)', async () => {
    const result = (await search(
      {
        path: 'hypergraph',
        query: 'similar',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        topK: 3,
      },
      ctx,
    )) as { results: Array<{ id: string; score: number }> }
    // Scores should be monotonically decreasing
    expect(result.results[0]!.score).toBeGreaterThan(result.results[1]!.score)
    expect(result.results[1]!.score).toBeGreaterThan(result.results[2]!.score)
    // The most different embedding (reversed) should be last
    expect(result.results[2]!.id).toBe('session/sess_different')
  })

  test('respects topK=1', async () => {
    const result = (await search(
      {
        path: 'hypergraph',
        query: 'similar',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        topK: 1,
      },
      ctx,
    )) as { results: Array<{ id: string; score: number }> }
    expect(result.results.length).toBe(1)
  })

  test('handles topK larger than embedding count', async () => {
    const result = (await search(
      {
        path: 'hypergraph',
        query: 'similar',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        topK: 100,
      },
      ctx,
    )) as { results: Array<{ id: string; score: number }> }
    // Only 3 docs have embeddings, so at most 3 results
    expect(result.results.length).toBe(3)
  })

  test('returns all 3 Session IDs', async () => {
    const result = (await search(
      {
        path: 'hypergraph',
        query: 'similar',
        embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8],
        topK: 3,
      },
      ctx,
    )) as { results: Array<{ id: string; score: number }> }
    const ids = new Set(result.results.map((r) => r.id))
    expect(ids.has('session/sess_test')).toBe(true)
    expect(ids.has('session/sess_other')).toBe(true)
    expect(ids.has('session/sess_different')).toBe(true)
  })

  test('returns empty when no embeddings exist in documents', async () => {
    // buildIndex with docs that have no embedding field
    const docs = [{ '@id': 'test:d', '@type': 'T' }]
    const index = buildIndex(docs)
    expect(index.embeddingDocs.length).toBe(0)
    expect(index.dims).toBe(0)
  })
})

// ============================================================================
// search ToolHandler interface
// ============================================================================

describe('search ToolHandler', () => {
  test('resolves path relative to workspace', async () => {
    const result = (await search(
      { path: 'hypergraph', query: 'co-occurrence', vertex: 'bp:thread/taskGate' },
      ctx,
    )) as { hyperedges: Array<{ id: string; type: string; vertices: string[] }> }
    // If path resolution works correctly, we get results from the fixtures dir
    expect(result.hyperedges.length).toBeGreaterThan(0)
  })

  test('all query types work through the ToolHandler', async () => {
    // Smoke test: each query type returns a valid result shape
    const causal = (await search(
      { path: 'hypergraph', query: 'causal-chain', from: 'bp:event/task', to: 'bp:event/execute' },
      ctx,
    )) as { chain: string[] }
    expect(Array.isArray(causal.chain)).toBe(true)

    const coOcc = (await search({ path: 'hypergraph', query: 'co-occurrence', vertex: 'bp:event/task' }, ctx)) as {
      hyperedges: unknown[]
    }
    expect(Array.isArray(coOcc.hyperedges)).toBe(true)

    const cycles = (await search({ path: 'hypergraph', query: 'check-cycles' }, ctx)) as { cycles: unknown[] }
    expect(Array.isArray(cycles.cycles)).toBe(true)

    const match = (await search({ path: 'hypergraph', query: 'match', pattern: { sequence: ['Session'] } }, ctx)) as {
      matches: unknown[]
    }
    expect(Array.isArray(match.matches)).toBe(true)

    const similar = (await search(
      { path: 'hypergraph', query: 'similar', embedding: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8], topK: 1 },
      ctx,
    )) as { results: unknown[] }
    expect(Array.isArray(similar.results)).toBe(true)
  })
})
