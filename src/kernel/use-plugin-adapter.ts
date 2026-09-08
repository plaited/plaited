/**
 * Shared MCP client connection pool — the adapter layer between the kernel
 * and remote MCP servers.
 *
 * @remarks
 * Mirrors the pi-extension pool pattern (getSharedClient + session_shutdown →
 * closeSharedClient): one live {@link Client} per server-url, lazily connected
 * on first use and reused across subsequent calls, `close()`d on teardown.
 *
 * The adapter owns **no discovery data** — it holds only a connection-level
 * cache of the last `discover()` result (`discovery`) for the documented entry
 * shape. The `.plaited/discovery.sqlite` store is owned by the `discovery`
 * tool, not here. Population/refresh/search are kernel-thread policy.
 *
 * MINIMAL: the cache key is the server-url alone. A second call to the same url
 * with different `headers`/`authProvider` reuses the first connection's request
 * init. Upgrade path: key by url + auth-fingerprint so per-call auth variants
 * get distinct connections.
 *
 * @packageDocumentation
 */

import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Capabilities gathered by a `discover` call, cached on the pool entry. */
export type McpDiscovery = {
  tools: unknown[]
  prompts: unknown[]
  resources: unknown[]
}

/** Options used to establish (and re-establish) a pooled connection. */
export type AdapterSessionOptions = {
  headers?: Record<string, string>
  authProvider?: OAuthClientProvider
  timeoutMs?: number
}

type PoolEntry = {
  client: Client
  /** Resolves to the connected client; shared by concurrent first-callers. */
  connectPromise: Promise<Client>
  /** Last discover() result cached on the connection (not the discovery store). */
  discovery?: McpDiscovery
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLIENT_INFO = { name: 'plaited', version: '0.0.0' }

// ---------------------------------------------------------------------------
// Pool
// ---------------------------------------------------------------------------

const pool = new Map<string, PoolEntry>()

/**
 * Lazily connect a {@link Client} for `url` and reuse it on subsequent calls.
 *
 * Concurrent first-callers share the same `connectPromise`; a failed connect
 * evicts the entry so the next call retries. The returned client is NOT closed
 * by the caller — the pool owns its lifecycle (see {@link closeSharedClient}).
 */
export const getSharedClient = async (url: string, options: AdapterSessionOptions): Promise<Client> => {
  const existing = pool.get(url)
  if (existing) return existing.connectPromise

  const client = new Client(CLIENT_INFO)
  const transport = new StreamableHTTPClientTransport(new URL(url), {
    requestInit: options.headers ? { headers: options.headers } : undefined,
    authProvider: options.authProvider,
  })
  const connectPromise = client.connect(transport).then(() => client)
  pool.set(url, { client, connectPromise })

  try {
    await connectPromise
  } catch (err) {
    // Evict on failure so the next call can retry instead of reusing a dead
    // connectPromise forever.
    pool.delete(url)
    try {
      await client.close()
    } catch {
      /* best-effort */
    }
    throw err
  }
  return client
}

/** Read the cached discover() result for a connection, if any. */
export const getPoolDiscovery = (url: string): McpDiscovery | undefined => pool.get(url)?.discovery

/** Store a discover() result on the connection's pool entry. */
export const setPoolDiscovery = (url: string, discovery: McpDiscovery): void => {
  const entry = pool.get(url)
  if (entry) entry.discovery = discovery
}

/** Close and drop a single connection from the pool. */
export const closeSharedClient = async (url: string): Promise<void> => {
  const entry = pool.get(url)
  if (!entry) return
  pool.delete(url)
  try {
    await entry.client.close()
  } catch {
    /* best-effort */
  }
}

/** Close and drop every pooled connection (teardown). */
export const closeAllClients = async (): Promise<void> => {
  const urls = [...pool.keys()]
  await Promise.all(urls.map((url) => closeSharedClient(url)))
}

/** Test/debug hook: the number of currently pooled connections. */
export const pooledClientCount = (): number => pool.size
