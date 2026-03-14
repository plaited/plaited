/**
 * Hypergraph utility functions for provenance derivation and session summaries.
 *
 * @remarks
 * Pure functions over JSON-LD decision documents. No WASM, no file I/O
 * (callers provide loaded documents). Used by the `provenance` query in
 * `hypergraph.ts` and by session consolidation handlers.
 *
 * @internal
 */

import type { Indexer } from '../agent/agent.types.ts'
import type { ProvenanceEdge } from './hypergraph.schemas.ts'
import { loadJsonLd } from './hypergraph.ts'

// ============================================================================
// Event Causation Map — derived from AGENT_EVENTS 6-step loop vocabulary
// ============================================================================

/**
 * Static causation map encoding which agent events can cause which.
 *
 * @remarks
 * Derived from the 6-step agent loop event vocabulary in `agent.constants.ts`.
 * Keys and values use bare event names (no `bp:event/` prefix).
 *
 * @internal
 */
export const EVENT_CAUSATION = new Map<string, string[]>([
  // Reactive path: task → context_assembly → invoke_inference → ...
  ['task', ['context_assembly']],
  ['context_assembly', ['invoke_inference']],
  ['invoke_inference', ['model_response']],
  ['model_response', ['context_ready']],
  ['context_ready', ['gate_approved', 'gate_rejected']],
  ['gate_approved', ['simulate_request', 'execute']],
  ['simulate_request', ['simulation_result']],
  ['simulation_result', ['eval_approved', 'eval_rejected']],
  ['eval_approved', ['execute']],
  ['execute', ['tool_result']],
  ['tool_result', ['invoke_inference', 'commit_snapshot']],
  ['gate_rejected', ['invoke_inference']],
  ['eval_rejected', ['invoke_inference']],
  // Commit vertex architecture: commit_snapshot → snapshot_committed (terminal)
  ['commit_snapshot', ['snapshot_committed']],
  // Proactive heartbeat path: tick → sensor_sweep → sensor_delta | sleep
  ['tick', ['sensor_sweep']],
  ['sensor_sweep', ['sensor_delta', 'sleep']],
  // sensor_delta merges into reactive path via context_assembly
  ['sensor_delta', ['context_assembly']],
  // Terminals: sleep, snapshot_committed, consolidate, defrag have no successors
])

// ============================================================================
// Provenance Edge Derivation
// ============================================================================

/**
 * Bid shape extracted from decision documents.
 *
 * @internal
 */
type Bid = {
  thread?: string
  event?: string
  type?: string
  selected?: boolean
  blockedBy?: string
  interrupts?: string
}

/**
 * Strip `bp:event/` or `bp:thread/` prefix from a URI, returning the bare name.
 *
 * @internal
 */
const stripPrefix = (uri: string): string => {
  if (uri.startsWith('bp:event/')) return uri.slice(9)
  if (uri.startsWith('bp:thread/')) return uri.slice(10)
  return uri
}

/**
 * Get the selected event name (bare, no prefix) from a decision's bids.
 *
 * @internal
 */
const getSelectedEvent = (bids: Bid[]): string | undefined => {
  for (const bid of bids) {
    if (bid.selected) {
      const eventRef = bid.event ?? bid.type
      if (typeof eventRef === 'string') return stripPrefix(eventRef)
    }
  }
  return undefined
}

/**
 * Get all threads with `selected: true` from a decision's bids.
 *
 * @internal
 */
const getSelectedThreads = (bids: Bid[]): Set<string> => {
  const threads = new Set<string>()
  for (const bid of bids) {
    if (bid.selected && typeof bid.thread === 'string') {
      threads.add(bid.thread)
    }
  }
  return threads
}

/**
 * Derive causal provenance edges from a sequence of decision documents.
 *
 * @remarks
 * Three signals on consecutive decision pairs (D_i, D_{i+1}):
 *
 * 1. **Thread continuity** — same thread has `selected: true` in both
 * 2. **Block→unblock** — D_i has bid with `blockedBy: X`, D_{i+1} has bid
 *    with `interrupts: X` and `selected: true`
 * 3. **Event chain** — D_i's selected event maps to D_{i+1}'s selected event
 *    via `EVENT_CAUSATION`
 *
 * @param decisions - Decision documents sorted by @id (or superstep)
 * @returns Deduplicated provenance edges
 *
 * @public
 */
export const deriveProvenanceEdges = (decisions: Record<string, unknown>[]): ProvenanceEdge[] => {
  if (decisions.length < 2) return []

  const edgeSet = new Set<string>()
  const edges: ProvenanceEdge[] = []

  const addEdge = (edge: ProvenanceEdge): void => {
    const key = `${edge.from}\0${edge.to}\0${edge.kind}\0${edge.via}`
    if (edgeSet.has(key)) return
    edgeSet.add(key)
    edges.push(edge)
  }

  for (let i = 0; i < decisions.length - 1; i++) {
    const dCurr = decisions[i]!
    const dNext = decisions[i + 1]!
    const currId = dCurr['@id'] as string
    const nextId = dNext['@id'] as string
    if (!currId || !nextId) continue

    const currBids = (dCurr.bids ?? []) as Bid[]
    const nextBids = (dNext.bids ?? []) as Bid[]

    // 1. Thread continuity — same thread selected in both decisions
    const currThreads = getSelectedThreads(currBids)
    const nextThreads = getSelectedThreads(nextBids)
    for (const thread of currThreads) {
      if (nextThreads.has(thread)) {
        addEdge({ from: currId, to: nextId, kind: 'thread_continuity', via: thread })
      }
    }

    // 2. Block→unblock — D_i has blockedBy X, D_{i+1} has selected bid that interrupts X
    for (const currBid of currBids) {
      if (typeof currBid.blockedBy !== 'string') continue
      const blockedThread = currBid.blockedBy
      for (const nextBid of nextBids) {
        if (nextBid.selected && nextBid.interrupts === blockedThread) {
          addEdge({ from: currId, to: nextId, kind: 'block_unblock', via: blockedThread })
        }
      }
    }

    // 3. Event chain — selected events in consecutive decisions linked by EVENT_CAUSATION
    const currEvent = getSelectedEvent(currBids)
    const nextEvent = getSelectedEvent(nextBids)
    if (currEvent && nextEvent) {
      const successors = EVENT_CAUSATION.get(currEvent)
      if (successors?.includes(nextEvent)) {
        addEdge({ from: currId, to: nextId, kind: 'event_chain', via: `${currEvent}->${nextEvent}` })
      }
    }
  }

  return edges
}

// ============================================================================
// Session Summary Builder
// ============================================================================

/**
 * Summary metadata for a session, derived from its decision documents.
 *
 * @internal
 */
export type SessionMeta = {
  '@id': string
  '@type': 'Session'
  summary: string
  embedding?: number[]
  threadTypes: string[]
  outcomeEvents: string[]
  toolsUsed: string[]
  decisionCount: number
  commits?: string[]
  timestamp: string
}

/**
 * Build a session summary from decision documents in a session directory.
 *
 * @remarks
 * Loads `.jsonld` files from `sessionDir`, filters to decision documents
 * (those with a `bids` array), and aggregates metadata. Optionally computes
 * an embedding via the `Indexer` interface.
 *
 * @param sessionDir - Absolute path to the session directory
 * @param sessionId - Session identifier for the `@id` field
 * @param embedder - Optional indexer for computing summary embeddings
 * @returns Session metadata matching `SessionMetaSchema`
 *
 * @public
 */
export const buildSessionSummary = async (
  sessionDir: string,
  sessionId: string,
  embedder?: Indexer,
): Promise<SessionMeta> => {
  const docs = await loadJsonLd(sessionDir)

  // Filter to decision documents (have bids array)
  const decisions = docs.filter((doc) => Array.isArray(doc.bids) && typeof doc['@id'] === 'string')

  // Collect commit vertex @id values
  const commitIds = docs
    .filter((doc) => doc['@type'] === 'Commit' && typeof doc['@id'] === 'string')
    .map((doc) => doc['@id'] as string)

  const threadTypeSet = new Set<string>()
  const outcomeEventSet = new Set<string>()
  const toolsUsedSet = new Set<string>()

  for (const doc of decisions) {
    const bids = doc.bids as Bid[]
    for (const bid of bids) {
      // Thread types — strip bp:thread/ prefix
      if (typeof bid.thread === 'string') {
        threadTypeSet.add(stripPrefix(bid.thread))
      }

      // Outcome events — from selected bids, strip bp:event/ prefix
      if (bid.selected) {
        const eventRef = bid.event ?? bid.type
        if (typeof eventRef === 'string') {
          outcomeEventSet.add(stripPrefix(eventRef))
        }
      }
    }

    // Extract toolsUsed from execute bids with detail.toolCall.name
    // (In practice, decision docs may not carry this detail directly;
    // this handles the case where they do)
    for (const bid of bids) {
      const detail = (bid as Record<string, unknown>).detail as Record<string, unknown> | undefined
      if (detail) {
        const toolCall = detail.toolCall as Record<string, unknown> | undefined
        if (toolCall && typeof toolCall.name === 'string') {
          toolsUsedSet.add(toolCall.name)
        }
      }
    }
  }

  const threadTypes = [...threadTypeSet].sort()
  const outcomeEvents = [...outcomeEventSet].sort()
  const toolsUsed = [...toolsUsedSet].sort()

  const summary = [
    `${decisions.length} decisions`,
    threadTypes.length > 0 ? `threads: ${threadTypes.join(', ')}` : null,
    outcomeEvents.length > 0 ? `events: ${outcomeEvents.join(', ')}` : null,
    toolsUsed.length > 0 ? `tools: ${toolsUsed.join(', ')}` : null,
  ]
    .filter(Boolean)
    .join('; ')

  let embedding: number[] | undefined
  if (embedder) {
    const embeddingFloat32 = await embedder.embed(summary)
    embedding = Array.from(embeddingFloat32)
  }

  const meta: SessionMeta = {
    '@id': sessionId,
    '@type': 'Session',
    summary,
    embedding,
    threadTypes,
    outcomeEvents,
    toolsUsed,
    decisionCount: decisions.length,
    timestamp: new Date().toISOString(),
  }
  if (commitIds.length > 0) {
    meta.commits = commitIds
  }
  return meta
}
