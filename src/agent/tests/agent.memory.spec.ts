import { afterAll, afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createMemoryDb, createSearchHandler, searchToolSchema } from '../agent.memory.ts'
import type { MemoryDb } from '../agent.memory.types.ts'
import { ToolDefinitionSchema } from '../agent.schemas.ts'

// ============================================================================
// Helpers
// ============================================================================

const createInMemoryDb = (workspace = '/tmp/test-workspace') => createMemoryDb({ path: ':memory:', workspace })

// ============================================================================
// createMemoryDb — database lifecycle
// ============================================================================

describe('createMemoryDb', () => {
  describe('database lifecycle', () => {
    test('creates in-memory database', () => {
      const memory = createInMemoryDb()
      expect(memory).toBeDefined()
      memory.close()
    })

    test('schema tables exist (sessions, messages, file_index)', () => {
      const { Database } = require('bun:sqlite')
      const db = new Database(':memory:')
      db.exec('PRAGMA journal_mode=WAL;')
      db.exec(`
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
        CREATE VIRTUAL TABLE IF NOT EXISTS file_index USING fts5(
          path, content, tokenize='porter unicode61'
        );
      `)

      // Verify tables via sqlite_master
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type IN ('table', 'table') ORDER BY name")
        .all()
        .map((r: { name: string }) => r.name)
      expect(tables).toContain('sessions')
      expect(tables).toContain('messages')
      // FTS5 creates the virtual table entry
      expect(tables).toContain('file_index')
      db.close()
    })

    test('close() works safely', () => {
      const memory = createInMemoryDb()
      memory.close()
      // Should not throw when closed
    })
  })

  // ============================================================================
  // Sessions
  // ============================================================================

  describe('sessions', () => {
    let memory: MemoryDb

    afterEach(() => {
      memory.close()
    })

    test('createSession returns UUID', () => {
      memory = createInMemoryDb()
      const id = memory.createSession('Hello prompt')
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
    })

    test('getSession retrieves data', () => {
      memory = createInMemoryDb()
      const id = memory.createSession('Test prompt')
      const session = memory.getSession(id)
      expect(session).toBeDefined()
      expect(session!.id).toBe(id)
      expect(session!.prompt).toBe('Test prompt')
      expect(session!.output).toBeNull()
      expect(session!.created_at).toBeDefined()
      expect(session!.updated_at).toBeDefined()
    })

    test('completeSession updates output', () => {
      memory = createInMemoryDb()
      const id = memory.createSession('Prompt')
      memory.completeSession(id, 'Final output')
      const session = memory.getSession(id)
      expect(session).toBeDefined()
      expect(session!.output).toBe('Final output')
    })

    test('getSession returns null for missing', () => {
      memory = createInMemoryDb()
      const session = memory.getSession('nonexistent-id')
      expect(session).toBeNull()
    })
  })

  // ============================================================================
  // Messages
  // ============================================================================

  describe('messages', () => {
    let memory: MemoryDb

    afterEach(() => {
      memory.close()
    })

    test('saveMessage stores user message', () => {
      memory = createInMemoryDb()
      const sessionId = memory.createSession('Hello')
      memory.saveMessage({ sessionId, role: 'user', content: 'Hello world' })
      const messages = memory.getMessages(sessionId)
      expect(messages).toHaveLength(1)
      expect(messages[0]!.role).toBe('user')
      expect(messages[0]!.content).toBe('Hello world')
      expect(messages[0]!.tool_call_id).toBeNull()
      expect(messages[0]!.tool_calls).toBeNull()
    })

    test('saveMessage stores assistant with tool_calls', () => {
      memory = createInMemoryDb()
      const sessionId = memory.createSession('Prompt')
      const toolCalls = [{ id: 'tc-1', type: 'function', function: { name: 'read_file', arguments: '{}' } }]
      memory.saveMessage({ sessionId, role: 'assistant', content: null, toolCalls })
      const messages = memory.getMessages(sessionId)
      expect(messages).toHaveLength(1)
      expect(messages[0]!.role).toBe('assistant')
      expect(messages[0]!.content).toBeNull()
      expect(messages[0]!.tool_calls).toBe(JSON.stringify(toolCalls))
    })

    test('saveMessage stores tool with tool_call_id', () => {
      memory = createInMemoryDb()
      const sessionId = memory.createSession('Prompt')
      memory.saveMessage({ sessionId, role: 'tool', content: 'file contents', toolCallId: 'tc-1' })
      const messages = memory.getMessages(sessionId)
      expect(messages).toHaveLength(1)
      expect(messages[0]!.role).toBe('tool')
      expect(messages[0]!.tool_call_id).toBe('tc-1')
    })

    test('getMessages ordered by id', () => {
      memory = createInMemoryDb()
      const sessionId = memory.createSession('Prompt')
      memory.saveMessage({ sessionId, role: 'user', content: 'first' })
      memory.saveMessage({ sessionId, role: 'assistant', content: 'second' })
      memory.saveMessage({ sessionId, role: 'user', content: 'third' })
      const messages = memory.getMessages(sessionId)
      expect(messages).toHaveLength(3)
      expect(messages[0]!.content).toBe('first')
      expect(messages[1]!.content).toBe('second')
      expect(messages[2]!.content).toBe('third')
      // IDs should be ascending
      expect(messages[0]!.id).toBeLessThan(messages[1]!.id)
      expect(messages[1]!.id).toBeLessThan(messages[2]!.id)
    })

    test('getMessages scoped to session', () => {
      memory = createInMemoryDb()
      const session1 = memory.createSession('Prompt 1')
      const session2 = memory.createSession('Prompt 2')
      memory.saveMessage({ sessionId: session1, role: 'user', content: 'session 1 msg' })
      memory.saveMessage({ sessionId: session2, role: 'user', content: 'session 2 msg' })
      const messages1 = memory.getMessages(session1)
      const messages2 = memory.getMessages(session2)
      expect(messages1).toHaveLength(1)
      expect(messages1[0]!.content).toBe('session 1 msg')
      expect(messages2).toHaveLength(1)
      expect(messages2[0]!.content).toBe('session 2 msg')
    })
  })

  // ============================================================================
  // FTS5 Search
  // ============================================================================

  describe('FTS5 search', () => {
    let memory: MemoryDb

    afterEach(() => {
      memory.close()
    })

    test('indexFile adds to index', () => {
      memory = createInMemoryDb()
      memory.indexFile('src/app.ts', 'export const app = () => console.log("hello")')
      const results = memory.search('app')
      expect(results).toHaveLength(1)
      expect(results[0]!.path).toBe('src/app.ts')
    })

    test('indexFile replaces on re-index', () => {
      memory = createInMemoryDb()
      memory.indexFile('src/app.ts', 'original content')
      memory.indexFile('src/app.ts', 'updated content')
      const results = memory.search('updated')
      expect(results).toHaveLength(1)
      expect(results[0]!.path).toBe('src/app.ts')
      // Original should not be found
      const oldResults = memory.search('original')
      expect(oldResults).toHaveLength(0)
    })

    test('search returns ranked results with snippets', () => {
      memory = createInMemoryDb()
      memory.indexFile('src/auth.ts', 'export const authenticate = (user: string) => validateToken(user)')
      memory.indexFile('src/db.ts', 'export const connect = () => new Database()')
      const results = memory.search('authenticate')
      expect(results).toHaveLength(1)
      expect(results[0]!.path).toBe('src/auth.ts')
      expect(results[0]!.snippet).toBeDefined()
      expect(results[0]!.rank).toBeDefined()
    })

    test('search empty for no matches', () => {
      memory = createInMemoryDb()
      memory.indexFile('src/app.ts', 'export const app = true')
      const results = memory.search('nonexistent_term_xyz')
      expect(results).toHaveLength(0)
    })

    test('search respects limit', () => {
      memory = createInMemoryDb()
      for (let i = 0; i < 10; i++) {
        memory.indexFile(`src/file${i}.ts`, `export const handler${i} = () => processRequest()`)
      }
      const results = memory.search('processRequest', 3)
      expect(results).toHaveLength(3)
    })

    test('FTS5 operators (AND, OR, NOT)', () => {
      memory = createInMemoryDb()
      memory.indexFile('src/auth.ts', 'authenticate user with token')
      memory.indexFile('src/db.ts', 'connect to database with credentials')
      memory.indexFile('src/api.ts', 'authenticate user through api endpoint')

      // AND: both terms
      const andResults = memory.search('authenticate AND token')
      expect(andResults).toHaveLength(1)
      expect(andResults[0]!.path).toBe('src/auth.ts')

      // OR: either term
      const orResults = memory.search('authenticate OR database')
      expect(orResults.length).toBeGreaterThanOrEqual(2)

      // NOT: exclude term
      const notResults = memory.search('authenticate NOT token')
      expect(notResults).toHaveLength(1)
      expect(notResults[0]!.path).toBe('src/api.ts')
    })

    test('porter stemming ("searching" matches "search")', () => {
      memory = createInMemoryDb()
      memory.indexFile('src/search.ts', 'export const search = (query: string) => findResults(query)')
      // "searching" should match "search" due to porter stemmer
      const results = memory.search('searching')
      expect(results).toHaveLength(1)
      expect(results[0]!.path).toBe('src/search.ts')
    })
  })

  // ============================================================================
  // indexWorkspace
  // ============================================================================

  describe('indexWorkspace', () => {
    let workspace: string
    let memory: MemoryDb

    beforeAll(async () => {
      workspace = await mkdtemp(join(tmpdir(), 'memory-index-test-'))
      await Bun.write(join(workspace, 'src/app.ts'), 'export const app = true')
      await Bun.write(join(workspace, 'README.md'), '# My Project')
      await Bun.write(join(workspace, 'config.json'), '{"key": "value"}')
      // Files that should be skipped
      await Bun.write(join(workspace, 'node_modules/pkg/index.js'), 'module.exports = {}')
      await Bun.write(join(workspace, 'image.png'), 'binary data')
    })

    afterAll(async () => {
      memory?.close()
      await rm(workspace, { recursive: true, force: true })
    })

    test('indexWorkspace indexes files, sets isIndexed', async () => {
      memory = createMemoryDb({ path: ':memory:', workspace })
      expect(memory.isIndexed()).toBe(false)
      await memory.indexWorkspace()
      expect(memory.isIndexed()).toBe(true)

      // Should find indexed TypeScript file
      const results = memory.search('app')
      expect(results.length).toBeGreaterThanOrEqual(1)
      const paths = results.map((r) => r.path)
      expect(paths).toContain('src/app.ts')
    })

    test('indexWorkspace skips node_modules/.git', async () => {
      memory = createMemoryDb({ path: ':memory:', workspace })
      await memory.indexWorkspace()
      // node_modules content should not be indexed (search for the unique term)
      const results = memory.search('"module" AND "exports"')
      expect(results).toHaveLength(0)
    })
  })
})

// ============================================================================
// createSearchHandler
// ============================================================================

describe('createSearchHandler', () => {
  let workspace: string
  let memory: MemoryDb

  beforeAll(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'search-handler-test-'))
    await Bun.write(join(workspace, 'src/auth.ts'), 'export const authenticate = (user: string) => true')
    await Bun.write(join(workspace, 'src/db.ts'), 'export const connect = () => new Database()')
  })

  afterAll(async () => {
    memory?.close()
    await rm(workspace, { recursive: true, force: true })
  })

  test('returns results for matching query', async () => {
    memory = createMemoryDb({ path: ':memory:', workspace })
    const handler = createSearchHandler(memory)
    const result = (await handler({ query: 'authenticate' }, { workspace })) as {
      query: string
      count: number
      results: Array<{ path: string; snippet: string; rank: number }>
    }
    expect(result.count).toBe(1)
    expect(result.results[0]!.path).toBe('src/auth.ts')
  })

  test('lazy indexes on first call', async () => {
    memory = createMemoryDb({ path: ':memory:', workspace })
    expect(memory.isIndexed()).toBe(false)
    const handler = createSearchHandler(memory)
    await handler({ query: 'connect' }, { workspace })
    expect(memory.isIndexed()).toBe(true)
  })

  test('returns message for no matches', async () => {
    memory = createMemoryDb({ path: ':memory:', workspace })
    const handler = createSearchHandler(memory)
    const result = (await handler({ query: 'nonexistent_xyz_term' }, { workspace })) as {
      message: string
      query: string
      results: unknown[]
    }
    expect(result.message).toBe('No results found')
    expect(result.results).toHaveLength(0)
  })
})

// ============================================================================
// searchToolSchema
// ============================================================================

describe('searchToolSchema', () => {
  test('validates against ToolDefinitionSchema', () => {
    const result = ToolDefinitionSchema.safeParse(searchToolSchema)
    expect(result.success).toBe(true)
  })
})
