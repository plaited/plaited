import { Database } from 'bun:sqlite'
import { relative } from 'node:path'
import { z } from 'zod'
import type { ToolDefinition } from '../../agent/agent.schemas.ts'
import type { ToolHandler } from '../../agent/agent.types.ts'
import { SearchConfigSchema } from './memory.schemas.ts'
import type {
  EventLogEntry,
  EventLogRow,
  MemoryDb,
  MemoryDbOptions,
  MessageRow,
  SearchResultRow,
  SessionRow,
} from './memory.types.ts'

// ============================================================================
// Schema SQL
// ============================================================================

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  prompt TEXT NOT NULL,
  output TEXT
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL,
  content TEXT,
  tool_call_id TEXT,
  tool_calls TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);

CREATE VIRTUAL TABLE IF NOT EXISTS file_index USING fts5(
  path, content, tokenize='porter unicode61'
);

CREATE TABLE IF NOT EXISTS event_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  event_type TEXT NOT NULL,
  thread TEXT NOT NULL,
  selected INTEGER NOT NULL DEFAULT 0,
  trigger INTEGER NOT NULL DEFAULT 0,
  priority INTEGER NOT NULL,
  blocked_by TEXT,
  interrupts TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_event_log_session ON event_log(session_id);
`

// ============================================================================
// File extensions indexed by workspace scanner
// ============================================================================

const INDEXABLE_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'json', 'md', 'css', 'html', 'yaml', 'yml', 'toml'])

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist'])

/** Max file size in bytes for indexing (100KB) */
const MAX_FILE_SIZE = 100_000

// ============================================================================
// createMemoryDb
// ============================================================================

/**
 * Creates a SQLite-backed memory database for session persistence and FTS5 search.
 *
 * @remarks
 * - Uses WAL mode for concurrent read performance
 * - Sessions track each `run()` invocation with prompt and output
 * - Messages persist the full conversation history for audit
 * - FTS5 index provides full-text search with porter stemming over workspace files
 * - Pass `':memory:'` as `path` for in-memory (test) databases
 *
 * @param options.path - SQLite database file path, or `':memory:'` for in-memory
 * @param options.workspace - Workspace root directory for file indexing
 * @returns A `MemoryDb` instance
 *
 * @public
 */
export const createMemoryDb = ({ path, workspace }: MemoryDbOptions): MemoryDb => {
  const db = new Database(path)
  db.exec('PRAGMA journal_mode=WAL;')
  db.exec(SCHEMA_SQL)

  let indexed = false

  // ---------------------------------------------------------------------------
  // Prepared statements
  // ---------------------------------------------------------------------------
  const insertSession = db.prepare('INSERT INTO sessions (id, prompt) VALUES ($id, $prompt)')

  const updateSession = db.prepare("UPDATE sessions SET output = $output, updated_at = datetime('now') WHERE id = $id")

  const selectSession = db.prepare<SessionRow, { $id: string }>(
    'SELECT id, created_at, updated_at, prompt, output FROM sessions WHERE id = $id',
  )

  const insertMessage = db.prepare(
    'INSERT INTO messages (session_id, role, content, tool_call_id, tool_calls) VALUES ($sessionId, $role, $content, $toolCallId, $toolCalls)',
  )

  const selectMessages = db.prepare<MessageRow, { $sessionId: string }>(
    'SELECT id, session_id, role, content, tool_call_id, tool_calls, created_at FROM messages WHERE session_id = $sessionId ORDER BY id',
  )

  const deleteFileIndex = db.prepare('DELETE FROM file_index WHERE path = $path')

  const insertFileIndex = db.prepare('INSERT INTO file_index (path, content) VALUES ($path, $content)')

  const searchQuery = db.prepare<{ path: string; snippet: string; rank: number }, { $query: string; $limit: number }>(
    `SELECT path, snippet(file_index, 1, '<mark>', '</mark>', '...', 32) as snippet, rank
     FROM file_index WHERE file_index MATCH $query
     ORDER BY rank LIMIT $limit`,
  )

  const insertEventLog = db.prepare(
    `INSERT INTO event_log (session_id, event_type, thread, selected, trigger, priority, blocked_by, interrupts, detail)
     VALUES ($sessionId, $eventType, $thread, $selected, $trigger, $priority, $blockedBy, $interrupts, $detail)`,
  )

  const selectEventLog = db.prepare<EventLogRow, { $sessionId: string; $limit: number }>(
    'SELECT id, session_id, event_type, thread, selected, trigger, priority, blocked_by, interrupts, detail, created_at FROM event_log WHERE session_id = $sessionId ORDER BY id LIMIT $limit',
  )

  // ---------------------------------------------------------------------------
  // Session CRUD
  // ---------------------------------------------------------------------------
  const createSession = (prompt: string): string => {
    const id = crypto.randomUUID()
    insertSession.run({ $id: id, $prompt: prompt })
    return id
  }

  const completeSession = (sessionId: string, output: string): void => {
    updateSession.run({ $id: sessionId, $output: output })
  }

  const getSession = (sessionId: string): SessionRow | null => {
    return selectSession.get({ $id: sessionId }) ?? null
  }

  // ---------------------------------------------------------------------------
  // Message CRUD
  // ---------------------------------------------------------------------------
  const saveMessage = ({
    sessionId,
    role,
    content,
    toolCallId,
    toolCalls,
  }: {
    sessionId: string
    role: string
    content?: string | null
    toolCallId?: string
    toolCalls?: unknown[]
  }): void => {
    insertMessage.run({
      $sessionId: sessionId,
      $role: role,
      $content: content ?? null,
      $toolCallId: toolCallId ?? null,
      $toolCalls: toolCalls ? JSON.stringify(toolCalls) : null,
    })
  }

  const getMessages = (sessionId: string): MessageRow[] => {
    return selectMessages.all({ $sessionId: sessionId })
  }

  // ---------------------------------------------------------------------------
  // FTS5 Search
  // ---------------------------------------------------------------------------
  const indexFile = (filePath: string, content: string): void => {
    deleteFileIndex.run({ $path: filePath })
    insertFileIndex.run({ $path: filePath, $content: content })
  }

  const indexWorkspace = async (): Promise<void> => {
    const glob = new Bun.Glob('**/*')
    const batch: Array<{ path: string; content: string }> = []

    for await (const entry of glob.scan({ cwd: workspace, onlyFiles: true })) {
      // Skip excluded directories
      const parts = entry.split('/')
      if (parts.some((p) => SKIP_DIRS.has(p))) continue

      // Check extension
      const ext = entry.split('.').pop() ?? ''
      if (!INDEXABLE_EXTENSIONS.has(ext)) continue

      // Check file size
      const file = Bun.file(`${workspace}/${entry}`)
      if (file.size > MAX_FILE_SIZE) continue

      const content = await file.text()
      const rel = relative(workspace, `${workspace}/${entry}`)
      batch.push({ path: rel, content })
    }

    // Batch insert inside transaction
    const insertBatch = db.transaction((items: Array<{ path: string; content: string }>) => {
      for (const item of items) {
        deleteFileIndex.run({ $path: item.path })
        insertFileIndex.run({ $path: item.path, $content: item.content })
      }
    })
    insertBatch(batch)
    indexed = true
  }

  const search = (query: string, limit = 20): SearchResultRow[] => {
    return searchQuery.all({ $query: query, $limit: limit })
  }

  const isIndexed = (): boolean => indexed

  const saveEventLog = (entry: EventLogEntry): void => {
    insertEventLog.run({
      $sessionId: entry.sessionId,
      $eventType: entry.eventType,
      $thread: entry.thread,
      $selected: entry.selected ? 1 : 0,
      $trigger: entry.trigger ? 1 : 0,
      $priority: entry.priority,
      $blockedBy: entry.blockedBy ?? null,
      $interrupts: entry.interrupts ?? null,
      $detail: entry.detail !== undefined ? JSON.stringify(entry.detail) : null,
    })
  }

  const getEventLog = (sessionId: string, limit = 500): EventLogRow[] => {
    return selectEventLog.all({ $sessionId: sessionId, $limit: limit })
  }

  const close = (): void => {
    db.close()
  }

  return {
    createSession,
    completeSession,
    getSession,
    saveMessage,
    getMessages,
    indexFile,
    indexWorkspace,
    search,
    isIndexed,
    saveEventLog,
    getEventLog,
    close,
  }
}

// ============================================================================
// Search Tool Schema
// ============================================================================

/**
 * OpenAI function-calling schema for the `search` tool.
 *
 * @remarks
 * Pass this alongside `builtInToolSchemas` to make search available to the model.
 *
 * @public
 */
export const searchToolSchema: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search',
    description:
      'Full-text search across workspace files. Returns ranked results with file paths and contextual snippets. Use this to find relevant code, configuration, or documentation.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query — supports FTS5 operators (AND, OR, NOT) and porter stemming',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of results to return (default: 20)',
        },
      },
      required: ['query'],
    },
  },
}

// ============================================================================
// Search Tool Handler Factory
// ============================================================================

/**
 * Creates a `ToolHandler` for the `search` tool with lazy workspace indexing.
 *
 * @remarks
 * On first invocation, indexes the entire workspace via `memory.indexWorkspace()`.
 * Subsequent calls use the cached FTS5 index. Returns structured results with
 * file paths, contextual snippets, and BM25 ranking scores.
 *
 * @param memory - A `MemoryDb` instance to query
 * @returns A `ToolHandler` for use with `createToolExecutor`
 *
 * @public
 */
export const createSearchHandler = (memory: MemoryDb): ToolHandler => {
  return async (args) => {
    const query = args.query as string
    const limit = (args.limit as number) ?? 20

    // Lazy index on first call
    if (!memory.isIndexed()) {
      await memory.indexWorkspace()
    }

    const results = memory.search(query, limit)

    if (results.length === 0) {
      return { message: 'No results found', query, results: [] }
    }

    return {
      query,
      count: results.length,
      results: results.map((r) => ({
        path: r.path,
        snippet: r.snippet,
        rank: r.rank,
      })),
    }
  }
}

// ============================================================================
// CLI Handler
// ============================================================================

export const searchCli = async (args: string[]): Promise<void> => {
  if (args.includes('--schema')) {
    // biome-ignore lint/suspicious/noConsole: CLI stdout output
    console.log(JSON.stringify(z.toJSONSchema(SearchConfigSchema), null, 2))
    return
  }
  const jsonIdx = args.indexOf('--json')
  const jsonArg = args[jsonIdx + 1]
  if (jsonIdx === -1 || !jsonArg) {
    console.error("Usage: plaited search --json '{...}' | --schema")
    process.exit(1)
  }
  const parsed = SearchConfigSchema.safeParse(JSON.parse(jsonArg))
  if (!parsed.success) {
    console.error(JSON.stringify(parsed.error.issues, null, 2))
    process.exit(1)
  }
  const { query, dbPath, workspace, limit } = parsed.data
  const memDb = createMemoryDb({
    path: dbPath ?? '.plaited/memory.db',
    workspace: workspace ?? process.cwd(),
  })
  try {
    if (!memDb.isIndexed()) {
      await memDb.indexWorkspace()
    }
    const results = memDb.search(query, limit)
    // biome-ignore lint/suspicious/noConsole: CLI stdout output
    console.log(JSON.stringify({ query, count: results.length, results }))
  } finally {
    memDb.close()
  }
}
