/**
 * Server module — thin I/O adapter between browser clients and the agent's BP.
 *
 * @remarks
 * This module provides:
 * - **Factory**: {@link createServer} — creates a Bun.serve-based server node, returns {@link ServerHandle}
 * - **Schemas**: {@link WebSocketDataSchema} — Zod validation for WebSocket connection data
 * - **Constants**: {@link SERVER_ERRORS} — error codes
 * - **Types**: {@link CreateServerOptions}, {@link ServerHandle}, {@link ReplayBufferOptions}, {@link WebSocketLimits}
 *
 * @public
 */

export * from './server/server.constants.ts'
export * from './server/server.schemas.ts'
export * from './server/server.ts'
export type * from './server/server.types.ts'
