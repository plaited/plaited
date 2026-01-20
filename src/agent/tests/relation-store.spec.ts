import { afterEach, describe, expect, test } from 'bun:test'
import { createRelationStore, type RelationNode, type RelationStore } from '../relation-store.ts'

// ============================================================================
// Test Helpers
// ============================================================================

let store: RelationStore

afterEach(() => {
  store?.clear()
})

// ============================================================================
// Basic CRUD Operations
// ============================================================================

describe('relation store (basic operations)', () => {
  test('creates empty store', () => {
    store = createRelationStore()

    expect(store.size()).toBe(0)
    expect(store.all()).toEqual([])
  })

  test('adds root node', () => {
    store = createRelationStore()

    store.add({
      id: 'plan-1',
      parents: [],
      edgeType: 'plan',
      context: { description: 'Implement feature' },
    })

    expect(store.size()).toBe(1)
    expect(store.has('plan-1')).toBe(true)
  })

  test('adds child node with parent', () => {
    store = createRelationStore()

    store.add({
      id: 'plan-1',
      parents: [],
      edgeType: 'plan',
      context: { description: 'Implement feature' },
    })

    store.add({
      id: 'step-1',
      parents: ['plan-1'],
      edgeType: 'step',
      context: { description: 'Create model', status: 'pending' },
    })

    expect(store.size()).toBe(2)
    expect(store.get('step-1')?.parents).toEqual(['plan-1'])
  })

  test('gets node by id', () => {
    store = createRelationStore()

    store.add({
      id: 'plan-1',
      parents: [],
      edgeType: 'plan',
      context: { description: 'Test plan' },
    })

    const node = store.get('plan-1')

    expect(node).toBeDefined()
    expect(node?.id).toBe('plan-1')
    expect(node?.context.description).toBe('Test plan')
    expect(node?.createdAt).toBeGreaterThan(0)
  })

  test('returns undefined for non-existent node', () => {
    store = createRelationStore()

    expect(store.get('non-existent')).toBeUndefined()
    expect(store.has('non-existent')).toBe(false)
  })

  test('updates node context', () => {
    store = createRelationStore()

    store.add({
      id: 'step-1',
      parents: [],
      edgeType: 'step',
      context: { description: 'Do something', status: 'pending' },
    })

    store.update('step-1', { status: 'done' })

    expect(store.get('step-1')?.context.status).toBe('done')
    expect(store.get('step-1')?.context.description).toBe('Do something')
  })

  test('throws on update non-existent node', () => {
    store = createRelationStore()

    expect(() => store.update('non-existent', { status: 'done' })).toThrow("Node 'non-existent' does not exist")
  })

  test('removes node', () => {
    store = createRelationStore()

    store.add({
      id: 'plan-1',
      parents: [],
      edgeType: 'plan',
      context: { description: 'Test' },
    })

    store.remove('plan-1')

    expect(store.has('plan-1')).toBe(false)
    expect(store.size()).toBe(0)
  })

  test('cleans up parent references on remove', () => {
    store = createRelationStore()

    store.add({
      id: 'plan-1',
      parents: [],
      edgeType: 'plan',
      context: { description: 'Plan' },
    })

    store.add({
      id: 'step-1',
      parents: ['plan-1'],
      edgeType: 'step',
      context: { description: 'Step' },
    })

    store.remove('plan-1')

    // step-1 should have empty parents now
    expect(store.get('step-1')?.parents).toEqual([])
  })

  test('removes descendants when flag is set', () => {
    store = createRelationStore()

    store.add({
      id: 'plan-1',
      parents: [],
      edgeType: 'plan',
      context: { description: 'Plan' },
    })

    store.add({
      id: 'step-1',
      parents: ['plan-1'],
      edgeType: 'step',
      context: { description: 'Step 1' },
    })

    store.add({
      id: 'step-2',
      parents: ['step-1'],
      edgeType: 'step',
      context: { description: 'Step 2' },
    })

    store.remove('plan-1', true)

    expect(store.size()).toBe(0)
  })

  test('clears all nodes', () => {
    store = createRelationStore()

    store.add({ id: 'a', parents: [], edgeType: 'test', context: { description: 'A' } })
    store.add({ id: 'b', parents: ['a'], edgeType: 'test', context: { description: 'B' } })

    store.clear()

    expect(store.size()).toBe(0)
    expect(store.all()).toEqual([])
  })
})

// ============================================================================
// Multi-Parent DAG
// ============================================================================

describe('relation store (multi-parent DAG)', () => {
  test('supports multiple parents', () => {
    store = createRelationStore()

    store.add({ id: 'a', parents: [], edgeType: 'plan', context: { description: 'A' } })
    store.add({ id: 'b', parents: [], edgeType: 'plan', context: { description: 'B' } })
    store.add({ id: 'c', parents: ['a', 'b'], edgeType: 'step', context: { description: 'C' } })

    const node = store.get('c')

    expect(node?.parents).toEqual(['a', 'b'])
    expect(store.parents('c')).toHaveLength(2)
  })

  test('throws on non-existent parent', () => {
    store = createRelationStore()

    expect(() =>
      store.add({
        id: 'child',
        parents: ['non-existent'],
        edgeType: 'step',
        context: { description: 'Child' },
      }),
    ).toThrow("Parent node 'non-existent' does not exist")
  })
})

// ============================================================================
// Cycle Detection
// ============================================================================

describe('relation store (cycle detection)', () => {
  test('detects self-reference cycle', () => {
    store = createRelationStore()

    expect(() =>
      store.add({
        id: 'a',
        parents: ['a'],
        edgeType: 'test',
        context: { description: 'Self' },
      }),
    ).toThrow('would create a cycle')
  })

  test('detects simple cycle', () => {
    store = createRelationStore()

    store.add({ id: 'a', parents: [], edgeType: 'test', context: { description: 'A' } })
    store.add({ id: 'b', parents: ['a'], edgeType: 'test', context: { description: 'B' } })

    // B is a descendant of A, so A cannot have B as parent
    expect(store.wouldCreateCycle('a', ['b'])).toBe(true)
  })

  test('detects transitive cycle', () => {
    store = createRelationStore()

    store.add({ id: 'a', parents: [], edgeType: 'test', context: { description: 'A' } })
    store.add({ id: 'b', parents: ['a'], edgeType: 'test', context: { description: 'B' } })
    store.add({ id: 'c', parents: ['b'], edgeType: 'test', context: { description: 'C' } })

    // C is a transitive descendant of A
    expect(store.wouldCreateCycle('a', ['c'])).toBe(true)
  })

  test('allows valid parent addition', () => {
    store = createRelationStore()

    store.add({ id: 'a', parents: [], edgeType: 'test', context: { description: 'A' } })
    store.add({ id: 'b', parents: [], edgeType: 'test', context: { description: 'B' } })

    // A and B are siblings, no cycle
    expect(store.wouldCreateCycle('a', ['b'])).toBe(false)
  })
})

// ============================================================================
// Traversal
// ============================================================================

describe('relation store (traversal)', () => {
  test('gets direct parents', () => {
    store = createRelationStore()

    store.add({ id: 'root', parents: [], edgeType: 'plan', context: { description: 'Root' } })
    store.add({ id: 'child', parents: ['root'], edgeType: 'step', context: { description: 'Child' } })

    const parents = store.parents('child')

    expect(parents).toHaveLength(1)
    expect(parents[0]?.id).toBe('root')
  })

  test('gets direct children', () => {
    store = createRelationStore()

    store.add({ id: 'root', parents: [], edgeType: 'plan', context: { description: 'Root' } })
    store.add({ id: 'child-1', parents: ['root'], edgeType: 'step', context: { description: 'Child 1' } })
    store.add({ id: 'child-2', parents: ['root'], edgeType: 'step', context: { description: 'Child 2' } })

    const children = store.children('root')

    expect(children).toHaveLength(2)
    expect(children.map((c) => c.id).sort()).toEqual(['child-1', 'child-2'])
  })

  test('gets all ancestors recursively', () => {
    store = createRelationStore()

    store.add({ id: 'grandparent', parents: [], edgeType: 'plan', context: { description: 'GP' } })
    store.add({ id: 'parent', parents: ['grandparent'], edgeType: 'step', context: { description: 'P' } })
    store.add({ id: 'child', parents: ['parent'], edgeType: 'step', context: { description: 'C' } })

    const ancestors = store.ancestors('child')

    expect(ancestors).toHaveLength(2)
    expect(ancestors.map((a) => a.id).sort()).toEqual(['grandparent', 'parent'])
  })

  test('gets all descendants recursively', () => {
    store = createRelationStore()

    store.add({ id: 'root', parents: [], edgeType: 'plan', context: { description: 'Root' } })
    store.add({ id: 'child', parents: ['root'], edgeType: 'step', context: { description: 'Child' } })
    store.add({ id: 'grandchild', parents: ['child'], edgeType: 'step', context: { description: 'GC' } })

    const descendants = store.descendants('root')

    expect(descendants).toHaveLength(2)
    expect(descendants.map((d) => d.id).sort()).toEqual(['child', 'grandchild'])
  })

  test('handles diamond dependency', () => {
    store = createRelationStore()

    // Diamond: A -> B, A -> C, B -> D, C -> D
    store.add({ id: 'a', parents: [], edgeType: 'plan', context: { description: 'A' } })
    store.add({ id: 'b', parents: ['a'], edgeType: 'step', context: { description: 'B' } })
    store.add({ id: 'c', parents: ['a'], edgeType: 'step', context: { description: 'C' } })
    store.add({ id: 'd', parents: ['b', 'c'], edgeType: 'step', context: { description: 'D' } })

    const ancestors = store.ancestors('d')

    // Should include a, b, c (no duplicates)
    expect(ancestors).toHaveLength(3)
    expect(ancestors.map((n) => n.id).sort()).toEqual(['a', 'b', 'c'])
  })

  test('gets root nodes', () => {
    store = createRelationStore()

    store.add({ id: 'root-1', parents: [], edgeType: 'plan', context: { description: 'R1' } })
    store.add({ id: 'root-2', parents: [], edgeType: 'plan', context: { description: 'R2' } })
    store.add({ id: 'child', parents: ['root-1'], edgeType: 'step', context: { description: 'C' } })

    const roots = store.roots()

    expect(roots).toHaveLength(2)
    expect(roots.map((r) => r.id).sort()).toEqual(['root-1', 'root-2'])
  })

  test('gets leaf nodes', () => {
    store = createRelationStore()

    store.add({ id: 'root', parents: [], edgeType: 'plan', context: { description: 'Root' } })
    store.add({ id: 'leaf-1', parents: ['root'], edgeType: 'step', context: { description: 'L1' } })
    store.add({ id: 'leaf-2', parents: ['root'], edgeType: 'step', context: { description: 'L2' } })

    const leaves = store.leaves()

    expect(leaves).toHaveLength(2)
    expect(leaves.map((l) => l.id).sort()).toEqual(['leaf-1', 'leaf-2'])
  })
})

// ============================================================================
// Filtering
// ============================================================================

describe('relation store (filtering)', () => {
  test('filters by edge type', () => {
    store = createRelationStore()

    store.add({ id: 'plan-1', parents: [], edgeType: 'plan', context: { description: 'P1' } })
    store.add({ id: 'step-1', parents: ['plan-1'], edgeType: 'step', context: { description: 'S1' } })
    store.add({ id: 'step-2', parents: ['plan-1'], edgeType: 'step', context: { description: 'S2' } })

    const plans = store.byEdgeType('plan')
    const steps = store.byEdgeType('step')

    expect(plans).toHaveLength(1)
    expect(steps).toHaveLength(2)
  })

  test('filters by status', () => {
    store = createRelationStore()

    store.add({ id: 's1', parents: [], edgeType: 'step', context: { description: 'S1', status: 'pending' } })
    store.add({ id: 's2', parents: [], edgeType: 'step', context: { description: 'S2', status: 'done' } })
    store.add({ id: 's3', parents: [], edgeType: 'step', context: { description: 'S3', status: 'pending' } })

    const pending = store.byStatus('pending')
    const done = store.byStatus('done')

    expect(pending).toHaveLength(2)
    expect(done).toHaveLength(1)
  })

  test('returns empty for non-matching filter', () => {
    store = createRelationStore()

    store.add({ id: 'a', parents: [], edgeType: 'plan', context: { description: 'A' } })

    expect(store.byEdgeType('non-existent')).toEqual([])
    expect(store.byStatus('failed')).toEqual([])
  })
})

// ============================================================================
// LLM Integration (toContext)
// ============================================================================

describe('relation store (toContext)', () => {
  test('formats single node', () => {
    store = createRelationStore()

    store.add({ id: 'plan-1', parents: [], edgeType: 'plan', context: { description: 'Implement auth' } })

    const context = store.toContext(['plan-1'])

    expect(context).toContain('plan: Implement auth')
  })

  test('includes status in format', () => {
    store = createRelationStore()

    store.add({
      id: 'step-1',
      parents: [],
      edgeType: 'step',
      context: { description: 'Create model', status: 'in_progress' },
    })

    const context = store.toContext(['step-1'])

    expect(context).toContain('[in_progress]')
  })

  test('shows parent references', () => {
    store = createRelationStore()

    store.add({ id: 'plan', parents: [], edgeType: 'plan', context: { description: 'Plan' } })
    store.add({ id: 'step', parents: ['plan'], edgeType: 'step', context: { description: 'Step' } })

    const context = store.toContext(['step'])

    expect(context).toContain('(parents: plan)')
  })

  test('formats with children indented', () => {
    store = createRelationStore()

    store.add({ id: 'plan', parents: [], edgeType: 'plan', context: { description: 'Main plan' } })
    store.add({ id: 'step-1', parents: ['plan'], edgeType: 'step', context: { description: 'Step 1' } })

    const context = store.toContext(['plan'])

    expect(context).toContain('plan: Main plan')
    expect(context).toContain('  step: Step 1')
  })
})

// ============================================================================
// Persistence
// ============================================================================

describe('relation store (persistence)', () => {
  test('calls onPersist when persist() is invoked', async () => {
    let persistedNodes: RelationNode[] = []

    store = createRelationStore({
      onPersist: (nodes) => {
        persistedNodes = nodes
      },
    })

    store.add({ id: 'a', parents: [], edgeType: 'test', context: { description: 'A' } })
    store.add({ id: 'b', parents: ['a'], edgeType: 'test', context: { description: 'B' } })

    await store.persist()

    expect(persistedNodes).toHaveLength(2)
  })

  test('auto-persists on mutation when configured', async () => {
    let persistCount = 0

    store = createRelationStore({
      autoPersist: true,
      onPersist: () => {
        persistCount++
      },
    })

    store.add({ id: 'a', parents: [], edgeType: 'test', context: { description: 'A' } })
    // Allow async to settle
    await new Promise((r) => setTimeout(r, 10))

    store.update('a', { status: 'done' })
    await new Promise((r) => setTimeout(r, 10))

    expect(persistCount).toBeGreaterThanOrEqual(2)
  })

  test('hydrates from initial nodes', () => {
    const initialNodes: RelationNode[] = [
      { id: 'restored-1', parents: [], edgeType: 'plan', context: { description: 'Restored' }, createdAt: 1000 },
    ]

    store = createRelationStore({ initialNodes })

    expect(store.size()).toBe(1)
    expect(store.has('restored-1')).toBe(true)
    expect(store.get('restored-1')?.createdAt).toBe(1000)
  })

  test('supports async onPersist', async () => {
    let persisted = false

    store = createRelationStore({
      onPersist: async () => {
        await new Promise((r) => setTimeout(r, 10))
        persisted = true
      },
    })

    store.add({ id: 'a', parents: [], edgeType: 'test', context: { description: 'A' } })
    await store.persist()

    expect(persisted).toBe(true)
  })

  test('does nothing if no onPersist configured', async () => {
    store = createRelationStore()

    store.add({ id: 'a', parents: [], edgeType: 'test', context: { description: 'A' } })

    // Should not throw
    await store.persist()
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('relation store (edge cases)', () => {
  test('handles empty parents array', () => {
    store = createRelationStore()

    store.add({ id: 'root', parents: [], edgeType: 'test', context: { description: 'Root' } })

    expect(store.parents('root')).toEqual([])
    expect(store.ancestors('root')).toEqual([])
  })

  test('handles non-existent node in traversal', () => {
    store = createRelationStore()

    expect(store.parents('non-existent')).toEqual([])
    expect(store.children('non-existent')).toEqual([])
    expect(store.ancestors('non-existent')).toEqual([])
    expect(store.descendants('non-existent')).toEqual([])
  })

  test('handles extensible context', () => {
    store = createRelationStore()

    store.add({
      id: 'custom',
      parents: [],
      edgeType: 'custom',
      context: {
        description: 'Custom node',
        status: 'pending',
        customField: 'custom value',
        nested: { foo: 'bar' },
      },
    })

    const node = store.get('custom')

    expect(node?.context.customField).toBe('custom value')
    expect((node?.context.nested as { foo: string })?.foo).toBe('bar')
  })

  test('remove is idempotent for non-existent node', () => {
    store = createRelationStore()

    // Should not throw
    store.remove('non-existent')

    expect(store.size()).toBe(0)
  })

  test('returns copies to prevent external mutation', () => {
    store = createRelationStore()

    store.add({ id: 'a', parents: [], edgeType: 'test', context: { description: 'A' } })

    const node = store.get('a')
    if (node) {
      node.context.description = 'Modified'
    }

    // Original should be unchanged
    expect(store.get('a')?.context.description).toBe('A')
  })
})
