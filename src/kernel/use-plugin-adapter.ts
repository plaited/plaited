/**
 * Shared MCP client connection pool — thin re-export shim.
 *
 * @remarks
 * The pool contract now lives in {@link ../kernel.ts}, which owns the
 * connection pool as kernel-floor state and injects it into the MCP client
 * tool at provisioning. This file re-exports the pool surface so pre-refactor
 * imports keep resolving during the collapse; it is deleted once nothing
 * references it (see Slice 4 of the use-plugin-adapter collapse).
 *
 * @packageDocumentation
 */

export type { AdapterSessionOptions, ConnectionPool, GetClientFn } from './kernel.ts'
export { createConnectionPool } from './kernel.ts'
