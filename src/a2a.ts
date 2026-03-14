/**
 * A2A protocol module — Bun-native Agent-to-Agent communication.
 *
 * @remarks
 * Three-layer architecture:
 * - **Layer 1** (Data Model): Constants + Zod schemas implementing the A2A wire format
 * - **Layer 2** (Operations): Type signatures for server handlers and client API
 * - **Layer 3** (Bindings): HTTP+JSON-RPC server handler factory and client
 *
 * @public
 */

export * from './a2a/a2a.client.ts'
export * from './a2a/a2a.constants.ts'
export * from './a2a/a2a.peers.ts'
export * from './a2a/a2a.schemas.ts'
export * from './a2a/a2a.server.ts'
export type * from './a2a/a2a.types.ts'
export * from './a2a/a2a.utils.ts'
export * from './a2a/a2a.ws-client.ts'
export * from './a2a/a2a.ws-server.ts'
