// ============================================================================
// Memory Database Types
// ============================================================================

/** Arguments for inserting an event log entry */
export type EventLogEntry = {
  sessionId: string
  eventType: string
  thread: string
  selected: boolean
  trigger: boolean
  priority: number
  blockedBy?: string
  interrupts?: string
  detail?: unknown
}

/** A persisted event log row */
export type EventLogRow = {
  id: number
  session_id: string
  event_type: string
  thread: string
  selected: number // SQLite boolean: 0 or 1
  trigger: number // SQLite boolean: 0 or 1
  priority: number
  blocked_by: string | null
  interrupts: string | null
  detail: string | null
  created_at: string
}

/** Options for creating a memory database */
export type MemoryDbOptions = {
  path: string
  workspace: string
}

/** A persisted session row */
export type SessionRow = {
  id: string
  created_at: string
  updated_at: string
  prompt: string
  output: string | null
}

/** A persisted message row */
export type MessageRow = {
  id: number
  session_id: string
  role: string
  content: string | null
  tool_call_id: string | null
  tool_calls: string | null
  created_at: string
}

/** A search result from the FTS5 index */
export type SearchResultRow = {
  path: string
  snippet: string
  rank: number
}

/**
 * Memory database interface — SQLite-backed session, message, and search persistence.
 *
 * @remarks
 * Created by `createMemoryDb()`. Provides session tracking, message persistence,
 * and FTS5 full-text search over workspace files.
 *
 * @public
 */
export type MemoryDb = {
  createSession: (prompt: string) => string
  completeSession: (sessionId: string, output: string) => void
  getSession: (sessionId: string) => SessionRow | null
  saveMessage: (args: {
    sessionId: string
    role: string
    content?: string | null
    toolCallId?: string
    toolCalls?: unknown[]
  }) => void
  getMessages: (sessionId: string) => MessageRow[]
  indexFile: (path: string, content: string) => void
  indexWorkspace: () => Promise<void>
  search: (query: string, limit?: number) => SearchResultRow[]
  isIndexed: () => boolean
  saveEventLog: (entry: EventLogEntry) => void
  getEventLog: (sessionId: string, limit?: number) => EventLogRow[]
  close: () => void
}
