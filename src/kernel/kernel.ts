/**
 * Kernel engine floor — owns shared process-lifetime state and wires
 * provisioned tools.
 *
 * @remarks
 * The kernel is the single home for state that tools must not hold as module
 * singletons: the MCP connection pool (and, later, the model-endpoint
 * registry). Tools are stateless via constructor injection; the kernel
 * instantiates the pool once and injects its `getClient` into the MCP client
 * tool at provisioning. The kernel also owns the pool's lifecycle —
 * {@link Kernel.shutdown} drains every pooled connection and is registered on
 * process teardown so no client leaks across an agent run.
 *
 * @packageDocumentation
 */

import { Client, type OAuthClientProvider, StreamableHTTPClientTransport } from '@modelcontextprotocol/client'
import { createMcpClientTool, type McpClientTool } from '../tools/mcp-client.ts'

// ---------------------------------------------------------------------------
// Pool contract types
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

/** Pool getter injected into the MCP client tool at provisioning. */
export type GetClientFn = (url: string, options: AdapterSessionOptions) => Promise<Client>

/** The ownable pool surface the kernel (or a test suite) instantiates. */
export type ConnectionPool = {
  /** Lazily connect a {@link Client} for `url` and reuse it on subsequent calls. */
  getClient: GetClientFn
  /** Close and drop a single connection. */
  closeClient: (url: string) => Promise<void>
  /** Close and drop every pooled connection (teardown). */
  closeAll: () => Promise<void>
  /** Test/debug hook: the number of currently pooled connections. */
  size: () => number
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CLIENT_INFO = { name: 'plaited', version: '0.0.0' }

// ---------------------------------------------------------------------------
// Pool factory — a closure, no module-level Map
// ---------------------------------------------------------------------------

/**
 * Build a connection-pool closure. The kernel instantiates this once and
 * injects `getClient` into {@link createMcpClientTool}; tests instantiate one
 * per suite for isolation. Concurrent first-callers share the same
 * `connectPromise`; a failed connect evicts the entry so the next call
 * retries. Callers never close the returned client — the pool owns its
 * lifecycle (see {@link ConnectionPool.closeAll}).
 *
 * MINIMAL: the pool key is the server-url alone. A second call to the same
 * url with different `headers`/`authProvider` reuses the first connection's
 * request init. Upgrade path: key by url + auth-fingerprint so per-call auth
 * variants get distinct connections.
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
// Kernel — owns the pool, wires the MCP client tool, drains on shutdown
// ---------------------------------------------------------------------------

/** Kernel engine surface: shared state + provisioned tools + lifecycle. */
export type Kernel = {
  /** The kernel-owned MCP connection pool. */
  pool: ConnectionPool
  /** MCP client tool provisioned with the kernel's pool getter. */
  mcpClient: McpClientTool
  /** Drain every pooled connection. Idempotent; registered on process teardown. */
  shutdown: () => Promise<void>
}

/**
 * Instantiate the kernel engine floor. Creates the connection pool, wires the
 * MCP client tool against the pool's `getClient`, and registers a teardown
 * hook so pooled connections drain on process exit. The pool is kernel-floor
 * state — the kernel owns it and its lifecycle.
 *
 * MINIMAL: a single process-teardown hook (`beforeExit`). Upgrade path: also
 * drain on SIGINT/SIGTERM with a flush timeout once the agent has a graceful
 * shutdown sequence wired through the controller.
 */
export const createKernel = (): Kernel => {
  const pool = createConnectionPool()
  const mcpClient = createMcpClientTool({ getClient: pool.getClient })

  let shuttingDown = false
  const shutdown = async (): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    await pool.closeAll()
  }

  // Drain pooled connections when the agent's event loop empties. `beforeExit`
  // can fire more than once; `shutdown` is idempotent so re-entry is safe.
  process.on('beforeExit', shutdown)

  return { pool, mcpClient, shutdown }
}
