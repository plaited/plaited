/**
 * Snapshot writer — bridges `useSnapshot` output to JSON-LD file persistence.
 *
 * @remarks
 * The BP engine emits {@link SnapshotMessage} on every super-step via `useSnapshot`.
 * This module converts `selection` snapshots into JSON-LD decision vertices
 * matching the format in `.memory/sessions/{sessionId}/decisions/`.
 *
 * Each decision is written as `{superstep}.jsonld` and tracked via
 * `memoryHandlers.trackDecision()` so the next `commit_snapshot` bundles it.
 *
 * Non-selection snapshots (errors, warnings) are ignored — they're diagnostic
 * only and handled by the `DiagnosticEntry` ring buffer elsewhere.
 *
 * @public
 */

import { join } from 'node:path'
import type { SelectionBid } from '../behavioral/behavioral.schemas.ts'
import type { SnapshotListener } from '../behavioral/behavioral.types.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for the snapshot writer factory.
 *
 * @public
 */
export type SnapshotWriterConfig = {
  /** Session identifier for the `@id` prefix */
  sessionId: string
  /** Absolute path to the `.memory/` directory */
  memoryPath: string
  /** Callback invoked when a decision vertex is written */
  trackDecision: (decisionId: string) => void
}

/**
 * A JSON-LD bid within a decision vertex.
 *
 * @internal
 */
type DecisionBid = {
  event: string
  thread: string
  selected: boolean
  priority: number
  blockedBy?: string
  interrupts?: string
}

// ============================================================================
// Decision Vertex Builder
// ============================================================================

/**
 * Convert a BP `SelectionBid` to a JSON-LD decision bid.
 *
 * @remarks
 * Adds `bp:event/` and `bp:thread/` URI prefixes to match the
 * fixture format in `src/tools/tests/fixtures/hypergraph/`.
 *
 * @internal
 */
const toBidVertex = (bid: SelectionBid): DecisionBid => {
  const result: DecisionBid = {
    event: `bp:event/${bid.type}`,
    thread: `bp:thread/${bid.thread}`,
    selected: bid.selected,
    priority: bid.priority,
  }
  if (bid.blockedBy) {
    result.blockedBy = `bp:thread/${bid.blockedBy}`
  }
  if (bid.interrupts) {
    result.interrupts = `bp:thread/${bid.interrupts}`
  }
  return result
}

/**
 * Build a JSON-LD SelectionDecision vertex from a snapshot's bids.
 *
 * @internal
 */
const buildDecisionVertex = (sessionId: string, superstep: number, bids: SelectionBid[]): Record<string, unknown> => ({
  '@id': `session/${sessionId}/decision/${superstep}`,
  '@type': 'SelectionDecision',
  superstep,
  timestamp: new Date().toISOString(),
  bids: bids.map(toBidVertex),
})

// ============================================================================
// Factory
// ============================================================================

/**
 * Create a snapshot listener that persists BP decisions as JSON-LD.
 *
 * @remarks
 * Returns a `SnapshotListener` callback compatible with `useSnapshot()`.
 * Maintains an internal superstep counter that increments on each
 * selection snapshot. Only `selection` snapshots produce decision files.
 *
 * @param config - Snapshot writer configuration
 * @returns A `SnapshotListener` callback for `useSnapshot()`
 *
 * @public
 */
export const createSnapshotWriter = ({
  sessionId,
  memoryPath,
  trackDecision,
}: SnapshotWriterConfig): SnapshotListener => {
  let superstep = 0
  const decisionsDir = join(memoryPath, 'sessions', sessionId, 'decisions')

  return async (msg) => {
    if (msg.kind !== 'selection') return

    superstep++
    const vertex = buildDecisionVertex(sessionId, superstep, msg.bids)
    const decisionId = vertex['@id'] as string
    const filePath = join(decisionsDir, `${superstep}.jsonld`)

    await Bun.write(filePath, `${JSON.stringify(vertex, null, 2)}\n`)
    trackDecision(decisionId)
  }
}
