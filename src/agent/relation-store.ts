/**
 * Relation Store - In-memory DAG for plans, files, agents, and any domain.
 *
 * @remarks
 * Provides a multi-parent directed acyclic graph (DAG) with:
 * - LLM-friendly structured context
 * - Pluggable persistence via callback
 * - Cycle detection on add
 * - Traversal utilities (ancestors, descendants, roots, leaves)
 *
 * **Design Principles:**
 * - In-memory first for fast traversal
 * - Plans are just nodes with `edgeType: 'plan'` / `'step'`
 * - I/O decoupled: user provides `onPersist` callback
 * - Loose schema: `NodeContext` is extensible
 *
 * @module
 */

// ============================================================================
// Types
// ============================================================================

/**
 * Structured context for LLM consumption.
 *
 * @remarks
 * Light structure with free-form extension.
 * The `description` field is always required for LLM context.
 */
export type NodeContext = {
  /** Human/LLM-readable description of this node */
  description: string
  /** Optional status for workflow tracking */
  status?: 'pending' | 'in_progress' | 'done' | 'failed'
  /** Extensible: add any additional fields */
  [key: string]: unknown
}

/**
 * A node in the relation DAG.
 *
 * @remarks
 * Supports multiple parents for flexible modeling.
 * Children know their parents; use traversal methods to find children.
 */
export type RelationNode = {
  /** Unique identifier for this node */
  id: string
  /** Parent node IDs (empty for root nodes) */
  parents: string[]
  /** Edge type for filtering (e.g., 'plan', 'step', 'file', 'agent') */
  edgeType: string
  /** Structured context for LLM consumption */
  context: NodeContext
  /** Unix timestamp when node was created */
  createdAt: number
}

/**
 * Configuration for relation store.
 */
export type RelationStoreConfig = {
  /**
   * Called when persist() is invoked.
   * Receives the full snapshot - user decides where/how to store.
   */
  onPersist?: (nodes: RelationNode[]) => void | Promise<void>
  /**
   * Initial nodes to hydrate the store.
   * User loads from wherever (file, API, DB) before creating store.
   */
  initialNodes?: RelationNode[]
  /**
   * If true, calls onPersist after every mutation.
   * @defaultValue false
   */
  autoPersist?: boolean
}

/**
 * Input for adding a node (createdAt is auto-generated).
 */
export type RelationNodeInput = Omit<RelationNode, 'createdAt'>

/**
 * Relation store interface.
 */
export type RelationStore = {
  // Core CRUD
  /** Add a new node to the store */
  add: (node: RelationNodeInput) => void
  /** Update a node's context (partial update) */
  update: (id: string, updates: Partial<NodeContext>) => void
  /** Remove a node and optionally its descendants */
  remove: (id: string, removeDescendants?: boolean) => void
  /** Get a node by ID */
  get: (id: string) => RelationNode | undefined
  /** Check if a node exists */
  has: (id: string) => boolean

  // Traversal
  /** Get all ancestors (recursive walk up parent chains) */
  ancestors: (id: string) => RelationNode[]
  /** Get all descendants (recursive walk down to children) */
  descendants: (id: string) => RelationNode[]
  /** Get direct parents only */
  parents: (id: string) => RelationNode[]
  /** Get direct children only */
  children: (id: string) => RelationNode[]
  /** Get all root nodes (no parents) */
  roots: () => RelationNode[]
  /** Get all leaf nodes (no children) */
  leaves: () => RelationNode[]

  // Filtering
  /** Filter nodes by edge type */
  byEdgeType: (edgeType: string) => RelationNode[]
  /** Filter nodes by status */
  byStatus: (status: NodeContext['status']) => RelationNode[]

  // DAG Safety
  /** Check if adding parents would create a cycle */
  wouldCreateCycle: (nodeId: string, parentIds: string[]) => boolean

  // LLM Integration
  /** Format nodes as LLM-friendly context string */
  toContext: (ids: string[]) => string

  // Persistence
  /** Persist current state via onPersist callback */
  persist: () => void | Promise<void>

  // Utilities
  /** Get all nodes */
  all: () => RelationNode[]
  /** Clear all nodes */
  clear: () => void
  /** Get node count */
  size: () => number
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Creates a relation store for managing DAG relationships.
 *
 * @param config - Store configuration
 * @returns Relation store instance
 *
 * @remarks
 * The store is in-memory by default. Use `onPersist` to save state
 * and `initialNodes` to restore it.
 */
export const createRelationStore = (config: RelationStoreConfig = {}): RelationStore => {
  const { onPersist, initialNodes = [], autoPersist = false } = config

  // In-memory storage
  const nodes = new Map<string, RelationNode>()

  // Hydrate from initial nodes
  for (const node of initialNodes) {
    nodes.set(node.id, { ...node })
  }

  /**
   * Triggers persistence if configured.
   * @internal
   */
  const maybePersist = async (): Promise<void> => {
    if (autoPersist && onPersist) {
      await onPersist([...nodes.values()])
    }
  }

  /**
   * Collects all ancestors recursively.
   * @internal
   */
  const collectAncestors = (id: string, visited: Set<string> = new Set()): RelationNode[] => {
    const result: RelationNode[] = []
    const node = nodes.get(id)
    if (!node) return result

    for (const parentId of node.parents) {
      if (visited.has(parentId)) continue
      visited.add(parentId)

      const parent = nodes.get(parentId)
      if (parent) {
        result.push(parent)
        result.push(...collectAncestors(parentId, visited))
      }
    }

    return result
  }

  /**
   * Collects all descendants recursively.
   * @internal
   */
  const collectDescendants = (id: string, visited: Set<string> = new Set()): RelationNode[] => {
    const result: RelationNode[] = []

    for (const node of nodes.values()) {
      if (node.parents.includes(id) && !visited.has(node.id)) {
        visited.add(node.id)
        result.push(node)
        result.push(...collectDescendants(node.id, visited))
      }
    }

    return result
  }

  /**
   * Checks if adding parents would create a cycle.
   * A cycle exists if any proposed parent is a descendant of the node.
   * @internal
   */
  const checkCycle = (nodeId: string, parentIds: string[]): boolean => {
    // Get all descendants of the node
    const descendantIds = new Set(collectDescendants(nodeId).map((n) => n.id))

    // If any parent is a descendant, adding it would create a cycle
    for (const parentId of parentIds) {
      if (descendantIds.has(parentId)) {
        return true
      }
      // Also check if parent is the node itself
      if (parentId === nodeId) {
        return true
      }
    }

    return false
  }

  const store: RelationStore = {
    add(input: RelationNodeInput): void {
      // Check for cycles before adding
      if (checkCycle(input.id, input.parents)) {
        throw new Error(`Adding node '${input.id}' with parents [${input.parents.join(', ')}] would create a cycle`)
      }

      // Validate parents exist (optional: could be lenient)
      for (const parentId of input.parents) {
        if (!nodes.has(parentId)) {
          throw new Error(`Parent node '${parentId}' does not exist`)
        }
      }

      const node: RelationNode = {
        ...input,
        createdAt: Date.now(),
      }

      nodes.set(input.id, node)
      void maybePersist()
    },

    update(id: string, updates: Partial<NodeContext>): void {
      const node = nodes.get(id)
      if (!node) {
        throw new Error(`Node '${id}' does not exist`)
      }

      node.context = { ...node.context, ...updates }
      void maybePersist()
    },

    remove(id: string, removeDescendants = false): void {
      if (!nodes.has(id)) return

      if (removeDescendants) {
        const descendants = collectDescendants(id)
        for (const desc of descendants) {
          nodes.delete(desc.id)
        }
      }

      nodes.delete(id)

      // Clean up parent references in remaining nodes
      for (const node of nodes.values()) {
        const idx = node.parents.indexOf(id)
        if (idx !== -1) {
          node.parents.splice(idx, 1)
        }
      }

      void maybePersist()
    },

    get(id: string): RelationNode | undefined {
      const node = nodes.get(id)
      return node ? { ...node, parents: [...node.parents], context: { ...node.context } } : undefined
    },

    has(id: string): boolean {
      return nodes.has(id)
    },

    ancestors(id: string): RelationNode[] {
      return collectAncestors(id)
    },

    descendants(id: string): RelationNode[] {
      return collectDescendants(id)
    },

    parents(id: string): RelationNode[] {
      const node = nodes.get(id)
      if (!node) return []

      return node.parents.map((pid) => nodes.get(pid)).filter((n): n is RelationNode => n !== undefined)
    },

    children(id: string): RelationNode[] {
      const result: RelationNode[] = []
      for (const node of nodes.values()) {
        if (node.parents.includes(id)) {
          result.push({ ...node })
        }
      }
      return result
    },

    roots(): RelationNode[] {
      const result: RelationNode[] = []
      for (const node of nodes.values()) {
        if (node.parents.length === 0) {
          result.push({ ...node })
        }
      }
      return result
    },

    leaves(): RelationNode[] {
      // A leaf has no children (no other node has it as parent)
      const hasChildren = new Set<string>()
      for (const node of nodes.values()) {
        for (const parentId of node.parents) {
          hasChildren.add(parentId)
        }
      }

      const result: RelationNode[] = []
      for (const node of nodes.values()) {
        if (!hasChildren.has(node.id)) {
          result.push({ ...node })
        }
      }
      return result
    },

    byEdgeType(edgeType: string): RelationNode[] {
      const result: RelationNode[] = []
      for (const node of nodes.values()) {
        if (node.edgeType === edgeType) {
          result.push({ ...node })
        }
      }
      return result
    },

    byStatus(status: NodeContext['status']): RelationNode[] {
      const result: RelationNode[] = []
      for (const node of nodes.values()) {
        if (node.context.status === status) {
          result.push({ ...node })
        }
      }
      return result
    },

    wouldCreateCycle(nodeId: string, parentIds: string[]): boolean {
      return checkCycle(nodeId, parentIds)
    },

    toContext(ids: string[]): string {
      const lines: string[] = []

      const formatNode = (node: RelationNode, indent: number): void => {
        const prefix = '  '.repeat(indent)
        const status = node.context.status ? ` [${node.context.status}]` : ''
        const deps = node.parents.length > 0 ? ` (parents: ${node.parents.join(', ')})` : ''

        lines.push(`${prefix}${node.edgeType}: ${node.context.description}${status}${deps}`)
      }

      // Format requested nodes
      for (const id of ids) {
        const node = nodes.get(id)
        if (node) {
          formatNode(node, 0)

          // Also show direct children indented
          const children = store.children(id)
          for (const child of children) {
            formatNode(child, 1)
          }
        }
      }

      return lines.join('\n')
    },

    async persist(): Promise<void> {
      if (onPersist) {
        await onPersist([...nodes.values()])
      }
    },

    all(): RelationNode[] {
      return [...nodes.values()].map((n) => ({ ...n }))
    },

    clear(): void {
      nodes.clear()
      void maybePersist()
    },

    size(): number {
      return nodes.size
    },
  }

  return store
}
