import { AGENT_CORE_EVENTS } from '../agent/agent.constants.ts'
import type { SnapshotMessage } from '../behavioral/behavioral.schemas.ts'
import type { SnapshotContextFactoryCreator } from './factories.types.ts'

const DEFAULT_TABLE_NAME = 'runtime_snapshots'
const INTERNAL_RUNTIME_EVENT_PREFIX = 'runtime_sql_'

const toJson = (value: unknown) => JSON.stringify(value)

const shouldPersistSnapshot = (snapshot: SnapshotMessage): boolean => {
  if (snapshot.kind !== 'selection') return true

  return snapshot.bids.some(
    (bid) => !bid.type.startsWith(INTERNAL_RUNTIME_EVENT_PREFIX) && bid.type !== AGENT_CORE_EVENTS.update_factories,
  )
}

/**
 * Captures behavioral snapshots into the agent's runtime SQLite context.
 *
 * @remarks
 * This is runtime working memory only. Durable promotion should happen later
 * through separate factories that read from runtime context and write to
 * git-backed artifacts plus hypergraph links.
 *
 * @public
 */
export const createSnapshotContextFactory: SnapshotContextFactoryCreator =
  (options) =>
  ({ trigger, useSnapshot }) => {
    const tableName = options?.tableName ?? DEFAULT_TABLE_NAME
    let isPersisting = false

    useSnapshot((snapshot: SnapshotMessage) => {
      if (isPersisting) return
      if (!shouldPersistSnapshot(snapshot)) return

      isPersisting = true
      trigger({
        type: AGENT_CORE_EVENTS.runtime_sql_run,
        detail: {
          requestId: `snapshot:${Date.now()}:${Math.random().toString(36).slice(2)}`,
          sql: `INSERT INTO ${tableName} (snapshot_kind, created_at, payload_json) VALUES (?, ?, ?)`,
          params: [snapshot.kind, new Date().toISOString(), toJson(snapshot)],
        },
      })
      isPersisting = false
    })

    return {}
  }
