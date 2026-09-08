/**
 * Shared MCP client connection pool — the adapter layer between the kernel
 * and remote MCP servers.
 *
 * @remarks
 * Mirrors the pi-extension pool pattern (getSharedClient + session_shutdown →
 * closeSharedClient): one live {@link Client} per server-url, lazily connected
 * on first use and reused across subsequent calls, `close()`d on teardown.
 *
 * The pool owns connection lifecycle only — nothing else. Discovery data is
 * the `discovery` tool's store (`.plaited/discovery.sqlite`), populated by
 * kernel-thread policy; the adapter holds no discovery cache.
 *
 * MINIMAL: the pool key is the server-url alone. A second call to the same url
 * with different `headers`/`authProvider` reuses the first connection's request
 * init. Upgrade path: key by url + auth-fingerprint so per-call auth variants
 * get distinct connections.
 *
 * @packageDocumentation
 */

import type { OAuthClientProvider } from '@modelcontextprotocol/client'
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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
