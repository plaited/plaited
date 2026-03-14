/**
 * Memory lifecycle handlers — commit_snapshot, consolidate, defrag.
 *
 * @remarks
 * Registered once at agent creation via `useFeedback()` (BP principle 6).
 * Memory handlers use `Bun.write` and `Bun.$` directly — they do NOT call
 * CRUD tools (which would re-enter the pipeline and cause infinite loops).
 *
 * **commit_snapshot**: Commits code + pending decisions, captures SHA,
 * writes a commit vertex (one-behind: vertex for commit N lands in commit N+1).
 *
 * **consolidate**: Archives individual decision files into `decisions.jsonl`,
 * writes `meta.jsonld` with session summary, then commits.
 *
 * **defrag**: Removes old sessions from the working tree, keeping recent N.
 *
 * @public
 */

import { join } from 'node:path'
import type { DefaultHandlers, Trigger } from '../behavioral/behavioral.types.ts'
import { buildSessionSummary } from '../tools/hypergraph.utils.ts'
import { AGENT_EVENTS } from './agent.constants.ts'
import type {
  CommitSnapshotDetail,
  ConsolidateDetail,
  DefragDetail,
  Indexer,
  SnapshotCommittedDetail,
} from './agent.types.ts'

// ============================================================================
// Types
// ============================================================================

/**
 * Configuration for memory handlers.
 *
 * @public
 */
export type MemoryHandlersConfig = {
  trigger: Trigger
  memoryPath: string
  sessionId: string
  embedder?: Indexer
  /** Maximum number of recent sessions to keep during defrag (default: 10) */
  keepSessions?: number
}

// ============================================================================
// Commit Vertex Builder
// ============================================================================

/**
 * Build a JSON-LD commit vertex.
 *
 * @internal
 */
const buildCommitVertex = (sha: string, modulePath: string, pendingDecisions: string[]): Record<string, unknown> => ({
  '@context': { bp: 'urn:bp:' },
  '@id': `bp:commit/${sha}`,
  '@type': 'Commit',
  sha,
  modulePath,
  attestsTo: pendingDecisions,
  timestamp: new Date().toISOString(),
})

// ============================================================================
// Handler Factory
// ============================================================================

/**
 * Create memory lifecycle handlers for the agent loop.
 *
 * @remarks
 * Returns a `DefaultHandlers` object to be registered once via `useFeedback()`.
 * Maintains a closure-scoped list of pending decision IDs that gets bundled
 * into each commit vertex and reset after each commit.
 *
 * @param config - Memory handler configuration
 * @returns Handler map for commit_snapshot, consolidate, and defrag events
 *
 * @public
 */
export const createMemoryHandlers = ({
  trigger,
  memoryPath,
  sessionId,
  embedder,
  keepSessions = 10,
}: MemoryHandlersConfig): DefaultHandlers => {
  /** Pending decision @id URIs accumulated since last commit */
  let pendingDecisions: string[] = []

  /**
   * Track a decision ID for inclusion in the next commit vertex.
   *
   * @remarks
   * Called externally (e.g. by useSnapshot listener) when a decision
   * document is written to disk.
   */
  const trackDecision = (decisionId: string) => {
    pendingDecisions.push(decisionId)
  }

  return {
    /**
     * commit_snapshot — git add + commit, capture SHA, write commit vertex.
     *
     * @remarks
     * The commit vertex for commit N is written AFTER the commit,
     * so it lands in commit N+1 (one-behind pattern).
     */
    [AGENT_EVENTS.commit_snapshot]: async (detail: unknown) => {
      const { modulePath } = detail as CommitSnapshotDetail

      // 1. Stage and commit all changes
      const addResult = Bun.spawnSync(['git', 'add', '-A'], { cwd: modulePath })
      if (addResult.exitCode !== 0) {
        console.error(`git add failed: ${addResult.stderr.toString()}`)
        return
      }

      const commitResult = Bun.spawnSync(
        ['git', 'commit', '-m', `snapshot: ${sessionId} (${pendingDecisions.length} decisions)`],
        { cwd: modulePath },
      )
      if (commitResult.exitCode !== 0) {
        // Nothing to commit is OK (no changes)
        const stderr = commitResult.stderr.toString()
        if (!stderr.includes('nothing to commit')) {
          console.error(`git commit failed: ${stderr}`)
          return
        }
      }

      // 2. Capture SHA
      const revParseResult = Bun.spawnSync(['git', 'rev-parse', 'HEAD'], { cwd: modulePath })
      const sha = revParseResult.stdout.toString().trim()
      if (!sha) {
        console.error('Failed to capture commit SHA')
        return
      }

      // 3. Write commit vertex (lands in next commit — one-behind)
      const commitsDir = join(memoryPath, 'sessions', sessionId, 'commits')
      const vertexPath = join(commitsDir, `${sha}.jsonld`)
      const vertex = buildCommitVertex(sha, modulePath, [...pendingDecisions])
      await Bun.write(vertexPath, `${JSON.stringify(vertex, null, 2)}\n`)

      // 4. Reset pending decisions
      pendingDecisions = []

      // 5. Trigger snapshot_committed
      const committedDetail: SnapshotCommittedDetail = { sha, modulePath }
      trigger({ type: AGENT_EVENTS.snapshot_committed, detail: committedDetail })
    },

    /**
     * consolidate — archive session decisions, write meta, final commit.
     */
    [AGENT_EVENTS.consolidate]: async (detail: unknown) => {
      const { sessionId: sid, memoryPath: mPath } = detail as ConsolidateDetail
      const sessionDir = join(mPath, 'sessions', sid)
      const decisionsDir = join(sessionDir, 'decisions')

      // 1. Glob decision files → concatenate to decisions.jsonl
      const glob = new Bun.Glob('*.jsonld')
      const lines: string[] = []
      for await (const path of glob.scan({ cwd: decisionsDir, onlyFiles: true })) {
        const content = await Bun.file(join(decisionsDir, path)).text()
        lines.push(content.trim())
      }
      if (lines.length > 0) {
        await Bun.write(join(sessionDir, 'decisions.jsonl'), `${lines.join('\n')}\n`)
      }

      // 2. Build session summary → write meta.jsonld
      const meta = await buildSessionSummary(sessionDir, sid, embedder)
      await Bun.write(join(sessionDir, 'meta.jsonld'), `${JSON.stringify(meta, null, 2)}\n`)

      // 3. Final git commit
      const moduleRoot = join(mPath, '..')
      Bun.spawnSync(['git', 'add', '-A'], { cwd: moduleRoot })
      Bun.spawnSync(['git', 'commit', '-m', `consolidate: session ${sid}`], { cwd: moduleRoot })
    },

    /**
     * defrag — remove old sessions, keep recent N.
     */
    [AGENT_EVENTS.defrag]: async (detail: unknown) => {
      const { memoryPath: mPath } = detail as DefragDetail
      const sessionsDir = join(mPath, 'sessions')
      const moduleRoot = join(mPath, '..')

      // List session directories, sorted chronologically
      const glob = new Bun.Glob('*')
      const sessions: string[] = []
      for await (const name of glob.scan({ cwd: sessionsDir, onlyFiles: false })) {
        // Check if it's a directory by looking for meta.jsonld or decisions/
        const metaExists = await Bun.file(join(sessionsDir, name, 'meta.jsonld')).exists()
        const decisionsExists = await Bun.file(join(sessionsDir, name, 'decisions')).exists()
        if (metaExists || decisionsExists) {
          sessions.push(name)
        }
      }
      sessions.sort()

      // Remove oldest sessions beyond keepSessions limit
      const toRemove = sessions.slice(0, Math.max(0, sessions.length - keepSessions))
      for (const session of toRemove) {
        const sessionPath = join(sessionsDir, session)
        Bun.spawnSync(['git', 'rm', '-rf', sessionPath], { cwd: moduleRoot })
      }

      if (toRemove.length > 0) {
        Bun.spawnSync(['git', 'commit', '-m', `defrag: removed ${toRemove.length} old sessions`], { cwd: moduleRoot })
      }
    },

    /** Expose trackDecision for external use (e.g. useSnapshot listener) */
    trackDecision,
  } as DefaultHandlers & { trackDecision: (id: string) => void }
}
