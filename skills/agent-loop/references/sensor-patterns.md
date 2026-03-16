# Sensor Generation Patterns

> Generation reference for frontier agents implementing the `SensorFactory` contract. Each pattern follows the same shape: **read → diff → delta**, with snapshot persistence and AbortSignal support.

## SensorFactory Contract

Every sensor implements this type from `src/agent/agent.types.ts`:

```typescript
import type { SensorFactory, SensorSnapshot } from '../agent.types.ts'

type SensorFactory = {
  name: string
  read: (signal: AbortSignal) => Promise<unknown>
  diff: (current: unknown, previous: SensorSnapshot | null) => unknown | null
  snapshotPath: string
}

type SensorSnapshot = {
  timestamp: string
  data: unknown
}
```

**Contract rules:**
- `read()` is **read-only** — never modify the environment
- `read()` receives an `AbortSignal` — check `signal.aborted` after async work
- `diff()` returns `null` when nothing changed (no delta fired)
- `diff()` receives `null` for `previous` on first run — decide whether to report everything as new or skip
- `snapshotPath` is relative to `.memory/sensors/` — the framework handles persistence
- Snapshots are simple JSON files — `{ timestamp, data }` round-trips via `Bun.file` / `Bun.write`

## Pattern 1: Git Sensor (Reference Implementation)

Watches for new commits and working tree status changes.

**Source:** `src/agent/sensors/git.ts`

```typescript
import type { SensorFactory, SensorSnapshot } from '../agent.types.ts'

export type GitSensorData = {
  headSha: string
  commits: string[]
  status: string[]
}

export type GitSensorDelta = {
  newCommits: string[]
  statusChanges: string[]
}

export const createGitSensor = (cwd?: string): SensorFactory => ({
  name: 'git',

  async read(signal: AbortSignal): Promise<GitSensorData> {
    const dir = cwd ?? process.cwd()

    const [logResult, statusResult] = await Promise.all([
      Bun.$`git log --oneline -10`.cwd(dir).nothrow().quiet(),
      Bun.$`git status --porcelain`.cwd(dir).nothrow().quiet(),
    ])

    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const logText = logResult.text().trim()
    const statusText = statusResult.text().trim()

    const commits = logText ? logText.split('\n') : []
    const headSha = commits[0]?.split(' ')[0] ?? ''
    const status = statusText ? statusText.split('\n').filter(Boolean) : []

    return { headSha, commits, status }
  },

  diff(current: unknown, previous: SensorSnapshot | null): GitSensorDelta | null {
    const curr = current as GitSensorData

    if (!previous) {
      return curr.commits.length > 0 || curr.status.length > 0
        ? { newCommits: curr.commits, statusChanges: curr.status }
        : null
    }

    const prev = previous.data as GitSensorData
    const prevCommitSet = new Set(prev.commits)
    const newCommits = curr.commits.filter((c) => !prevCommitSet.has(c))

    const prevStatusSet = new Set(prev.status)
    const currStatusSet = new Set(curr.status)
    const statusChanges = [
      ...curr.status.filter((s) => !prevStatusSet.has(s)),
      ...prev.status.filter((s) => !currStatusSet.has(s)).map((s) => `-${s}`),
    ]

    if (newCommits.length === 0 && statusChanges.length === 0) return null

    return { newCommits, statusChanges }
  },

  snapshotPath: 'git.json',
})
```

**Key decisions:**
- `Bun.$` for shell commands — `.nothrow()` prevents crash on non-zero exit, `.quiet()` suppresses stderr
- `cwd` parameter for multi-repo monitoring
- Diff uses Set intersection — O(n) comparison, handles rebase/force-push gracefully
- Status changes prefixed with `-` for removals (files that were modified but are now clean)

## Pattern 2: Filesystem Sensor

Watches a directory for file modification times (new files, changed files, deleted files).

```typescript
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import type { SensorFactory, SensorSnapshot } from '../agent.types.ts'

export type FsSensorData = {
  files: Record<string, number> // path → mtime ms
}

export type FsSensorDelta = {
  added: string[]
  modified: string[]
  removed: string[]
}

export const createFsSensor = (watchDir: string, glob?: string): SensorFactory => ({
  name: `fs:${watchDir}`,

  async read(signal: AbortSignal): Promise<FsSensorData> {
    const entries = await readdir(watchDir, { recursive: true })
    if (signal.aborted) throw new DOMException('Aborted', 'AbortError')

    const files: Record<string, number> = {}
    for (const entry of entries) {
      if (glob && !Bun.Glob.match(glob, entry)) continue
      const fullPath = join(watchDir, entry)
      const info = await stat(fullPath).catch(() => null)
      if (info?.isFile()) {
        files[entry] = info.mtimeMs
      }
    }

    return { files }
  },

  diff(current: unknown, previous: SensorSnapshot | null): FsSensorDelta | null {
    const curr = current as FsSensorData

    if (!previous) {
      const added = Object.keys(curr.files)
      return added.length > 0 ? { added, modified: [], removed: [] } : null
    }

    const prev = previous.data as FsSensorData
    const added: string[] = []
    const modified: string[] = []
    const removed: string[] = []

    // Detect added and modified
    for (const [path, mtime] of Object.entries(curr.files)) {
      if (!(path in prev.files)) {
        added.push(path)
      } else if (mtime !== prev.files[path]) {
        modified.push(path)
      }
    }

    // Detect removed
    for (const path of Object.keys(prev.files)) {
      if (!(path in curr.files)) {
        removed.push(path)
      }
    }

    if (added.length === 0 && modified.length === 0 && removed.length === 0) return null

    return { added, modified, removed }
  },

  snapshotPath: `fs-${watchDir.replaceAll('/', '-').replace(/^-/, '')}.json`,
})
```

**Key decisions:**
- Uses `node:fs/promises` — `readdir({ recursive: true })` covers nested directories
- `Bun.Glob.match` for optional file-type filtering (e.g., `"*.pdf"`)
- mtime comparison — detects content changes without reading file bodies
- Snapshot path derived from watch directory — avoids collisions for multiple sensors

## Pattern 3: HTTP Sensor

Polls an endpoint and diffs the response body. Useful for uptime monitoring, API status, or data feeds.

```typescript
import type { SensorFactory, SensorSnapshot } from '../agent.types.ts'

export type HttpSensorData = {
  status: number
  body: string
  headers: Record<string, string>
}

export type HttpSensorDelta = {
  statusChanged: boolean
  previousStatus: number | null
  currentStatus: number
  bodyChanged: boolean
  bodyDiff?: string
}

export const createHttpSensor = (
  url: string,
  options?: { headers?: Record<string, string>; timeoutMs?: number },
): SensorFactory => ({
  name: `http:${new URL(url).hostname}`,

  async read(signal: AbortSignal): Promise<HttpSensorData> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 10_000)

    // Chain caller's signal to our controller
    signal.addEventListener('abort', () => controller.abort(), { once: true })

    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: options?.headers,
      })
      const body = await res.text()
      const headers = Object.fromEntries(res.headers.entries())
      return { status: res.status, body, headers }
    } finally {
      clearTimeout(timeout)
    }
  },

  diff(current: unknown, previous: SensorSnapshot | null): HttpSensorDelta | null {
    const curr = current as HttpSensorData

    if (!previous) {
      // First run — only report if non-200
      return curr.status !== 200
        ? { statusChanged: true, previousStatus: null, currentStatus: curr.status, bodyChanged: true }
        : null
    }

    const prev = previous.data as HttpSensorData
    const statusChanged = curr.status !== prev.status
    const bodyChanged = curr.body !== prev.body

    if (!statusChanged && !bodyChanged) return null

    return {
      statusChanged,
      previousStatus: prev.status,
      currentStatus: curr.status,
      bodyChanged,
      bodyDiff: bodyChanged ? `${prev.body.length}→${curr.body.length} chars` : undefined,
    }
  },

  snapshotPath: `http-${new URL(url).hostname}.json`,
})
```

**Key decisions:**
- AbortSignal chaining — respects both the framework's signal and a per-request timeout
- First run returns `null` for 200 OK — avoids spurious "everything is new" deltas on startup
- Body diff is length-based by default — full diff is expensive and rarely useful for the agent
- Headers captured in snapshot for future diff needs without breaking the contract

## Pattern 4: Web Search Sensor (Vendor-Agnostic)

Polls a REST search API and diffs result URLs between snapshots. Works with any provider: You.com, Brave, Tavily, SearXNG, or custom.

**`.env.schema` (required — uses Varlock):**

```ini
SEARCH_API_URL=
  @sensitive
  @required
  @type url
  @description REST search API endpoint (You.com, Brave, Tavily, SearXNG, etc.)

SEARCH_API_KEY=
  @sensitive
  @required
  @description API key for the search provider
  @source exec('op read "op://Plaited/search-api-key/credential"')
```

**Implementation:**

```typescript
import type { SensorFactory, SensorSnapshot } from '../agent.types.ts'

export type SearchResult = {
  url: string
  title: string
  snippet: string
}

export type SearchSensorData = {
  query: string
  results: SearchResult[]
}

export type SearchSensorDelta = {
  query: string
  newResults: SearchResult[]
}

export const createSearchSensor = (
  query: string,
  options?: { maxResults?: number },
): SensorFactory => ({
  name: `search:${query.slice(0, 30)}`,

  async read(signal: AbortSignal): Promise<SearchSensorData> {
    const apiUrl = process.env.SEARCH_API_URL
    const apiKey = process.env.SEARCH_API_KEY
    if (!apiUrl || !apiKey) {
      throw new Error('SEARCH_API_URL and SEARCH_API_KEY must be set in .env.schema')
    }

    const url = new URL(apiUrl)
    url.searchParams.set('q', query)
    if (options?.maxResults) url.searchParams.set('count', String(options.maxResults))

    const res = await fetch(url, {
      signal,
      headers: { Authorization: `Bearer ${apiKey}` },
    })

    if (!res.ok) {
      throw new Error(`Search API returned ${res.status}: ${await res.text()}`)
    }

    const json = await res.json() as { results?: SearchResult[] }

    // Normalize — most APIs return results under a `results` key
    // Adapt this path for your provider's response shape
    const results: SearchResult[] = (json.results ?? []).map((r) => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet,
    }))

    return { query, results }
  },

  diff(current: unknown, previous: SensorSnapshot | null): SearchSensorDelta | null {
    const curr = current as SearchSensorData

    if (!previous) {
      return curr.results.length > 0
        ? { query: curr.query, newResults: curr.results }
        : null
    }

    const prev = previous.data as SearchSensorData
    const prevUrls = new Set(prev.results.map((r) => r.url))
    const newResults = curr.results.filter((r) => !prevUrls.has(r.url))

    if (newResults.length === 0) return null

    return { query: curr.query, newResults }
  },

  snapshotPath: `search-${query.replaceAll(/\W+/g, '-').slice(0, 40)}.json`,
})
```

**Key decisions:**
- **Vendor-agnostic** — reads `SEARCH_API_URL` from environment, not hardcoded
- **Varlock integration** — both `SEARCH_API_URL` and `SEARCH_API_KEY` declared in `.env.schema` with `@sensitive` markers. The agent generates the schema entry; Varlock resolves the actual secret at runtime
- **URL-based diff** — new URLs that weren't in the previous snapshot = new results. Simple, effective for monitoring search landscape changes
- **Normalize step** — adapts to different provider response shapes. Comment guides the generating agent to adjust the path
- **Query in snapshot path** — multiple search sensors (different queries) persist independently

**Provider compatibility notes:**
- **You.com** — `https://api.ydc-index.io/search` with `Bearer` auth
- **Brave** — `https://api.search.brave.com/res/v1/web/search` with `X-Subscription-Token` header
- **Tavily** — `https://api.tavily.com/search` with API key in body
- **SearXNG** — self-hosted `http://localhost:8888/search?format=json` (no key needed)

The generating agent adapts the `headers` and response normalization for the chosen provider.

## Sensor Composition Pattern

Multiple sensors compose additively — each runs independently during the tick sweep:

```typescript
const sensors: SensorFactory[] = [
  createGitSensor(),
  createFsSensor('~/Documents', '*.pdf'),
  createHttpSensor('https://api.example.com/health'),
  createSearchSensor('plaited framework updates'),
]

// Passed to createAgentLoop:
createAgentLoop({
  // ...
  proactive: {
    intervalMs: 15 * 60 * 1000,
    sensors,
  },
})
```

The framework's tick handler runs all sensors in parallel via `Promise.all`, fires `sensor_delta` for each non-null diff, and creates a `sensorBatch` bThread to coordinate the results. Zero deltas → `sleep` event → agent waits for next tick.

## Snapshot Lifecycle

```
.memory/sensors/
├── git.json              # { timestamp: "...", data: { headSha, commits, status } }
├── fs-Documents.json     # { timestamp: "...", data: { files: { "a.pdf": 1710... } } }
├── http-api.example.com.json
└── search-plaited-framework-updates.json
```

**Persistence flow:**
1. Tick handler loads snapshot: `Bun.file('.memory/sensors/' + sensor.snapshotPath).json()`
2. Sensor reads current state: `sensor.read(signal)`
3. Sensor diffs: `sensor.diff(current, previousSnapshot)`
4. If delta: trigger `sensor_delta` event
5. Save new snapshot: `Bun.write('.memory/sensors/' + sensor.snapshotPath, JSON.stringify({ timestamp: new Date().toISOString(), data: current }))`

**First run:** Previous snapshot is `null` — the sensor's `diff()` decides whether to treat the initial state as all-new (git sensor does this) or as baseline (HTTP sensor returns `null` for 200 OK).

## Writing Tests for Sensors

Every generated sensor needs a companion test file:

```typescript
import { describe, test, expect } from 'bun:test'
import { createFsSensor } from './fs.ts'
import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

describe('createFsSensor', () => {
  test('read() returns file modification times', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'sensor-test-'))
    await writeFile(join(dir, 'test.txt'), 'hello')

    const sensor = createFsSensor(dir)
    const data = await sensor.read(AbortSignal.timeout(5000))

    expect(data).toHaveProperty('files')
    expect(Object.keys(data.files)).toContain('test.txt')
    await rm(dir, { recursive: true })
  })

  test('diff() detects new files', async () => {
    const sensor = createFsSensor('/tmp')
    const prev = { timestamp: '2025-01-01T00:00:00Z', data: { files: {} } }
    const curr = { files: { 'new.pdf': Date.now() } }

    const delta = sensor.diff(curr, prev)
    expect(delta).not.toBeNull()
    expect(delta.added).toContain('new.pdf')
  })

  test('diff() returns null when nothing changed', () => {
    const sensor = createFsSensor('/tmp')
    const files = { 'a.txt': 1000 }
    const prev = { timestamp: '2025-01-01T00:00:00Z', data: { files } }

    expect(sensor.diff({ files }, prev)).toBeNull()
  })
})
```

**Test pattern:** real filesystem for `read()`, synthetic data for `diff()`. This matches the framework's testing conventions — prefer real dependencies over mocks.
