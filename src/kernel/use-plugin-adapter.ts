/**
 * Shared MCP client connection pool — the adapter layer between the kernel
 * and remote MCP servers.
 *
 * @remarks
 * One live {@link Client} per server-url, lazily connected on first use and
 * reused across subsequent calls, `close()`d on teardown. The pool owns
 * connection lifecycle only — nothing else. Discovery data is the
 * `discovery` tool's store (`.plaited/discovery.sqlite`), populated by
 * kernel-thread policy; the adapter holds no discovery cache.
 *
 * The pool is a closure built by {@link createConnectionPool}, not a
 * module-level singleton: the kernel instantiates it once and injects its
 * `getClient` into `createMcpClientTool` at provisioning; tests instantiate
 * one per suite. The module-level exports below (`getSharedClient`, etc.)
 * delegate to a default instance so pre-refactor imports keep working during
 * the collapse; they are removed once the kernel owns the pool outright.
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
// Pool factory — a closure, no module-level Map
// ---------------------------------------------------------------------------

/** The ownable pool surface the kernel (or a test suite) instantiates. */
export type ConnectionPool = {
  /** Lazily connect a {@link Client} for `url` and reuse it on subsequent calls. */
  getClient: (url: string, options: AdapterSessionOptions) => Promise<Client>
  /** Close and drop a single connection. */
  closeClient: (url: string) => Promise<void>
  /** Close and drop every pooled connection (teardown). */
  closeAll: () => Promise<void>
  /** Test/debug hook: the number of currently pooled connections. */
  size: () => number
}

/**
 * Build a connection-pool closure. The kernel instantiates this once and
 * injects `getClient` into `createMcpClientTool`; tests instantiate one per
 * suite for isolation. Concurrent first-callers share the same
 * `connectPromise`; a failed connect evicts the entry so the next call
 * retries. Callers never close the returned client — the pool owns its
 * lifecycle (see {@link ConnectionPool.closeAll}).
 */
export const createConnectionPool = (): ConnectionPool => {
  const pool = new Map<string, PoolEntry>()

  const getClient = async (url: string, options: AdapterSessionOptions): Promise<Client> => {
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

  const closeClient = async (url: string): Promise<void> => {
    const entry = pool.get(url)
    if (!entry) return
    pool.delete(url)
    try {
      await entry.client.close()
    } catch {
      /* best-effort */
    }
  }

  const closeAll = async (): Promise<void> => {
    const urls = [...pool.keys()]
    await Promise.all(urls.map((url) => closeClient(url)))
  }

  const size = (): number => pool.size

  return { getClient, closeClient, closeAll, size }
}

// ---------------------------------------------------------------------------
// Default instance + legacy module-level exports
//
// Pre-refactor callers imported `getSharedClient` / `closeAllClients` /
// `pooledClientCount` as module singletons. They delegate to one default pool
// instance so those imports keep working during the collapse. The kernel
// (and tests) instead call {@link createConnectionPool} directly.
// ---------------------------------------------------------------------------

const defaultPool = createConnectionPool()

/** Lazily connect + reuse a client for `url` (default pool). @deprecated use {@link createConnectionPool} */
export const getSharedClient = defaultPool.getClient

/** Close and drop a single connection (default pool). @deprecated use {@link createConnectionPool} */
export const closeSharedClient = defaultPool.closeClient

/** Close and drop every pooled connection (default pool). @deprecated use {@link createConnectionPool} */
export const closeAllClients = defaultPool.closeAll

/** Test/debug hook: pooled connection count (default pool). @deprecated use {@link createConnectionPool} */
export const pooledClientCount = defaultPool.size
