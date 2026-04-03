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

export * from './factories/a2a-factory/a2a.constants.ts'
export * from './factories/a2a-factory/a2a.schemas.ts'
export type * from './factories/a2a-factory/a2a.types.ts'
export * from './factories/a2a-factory/a2a.utils.ts'
export * from './factories/a2a-factory/create-a2a-client.ts'
export * from './factories/a2a-factory/create-a2a-handlers.ts'
export * from './factories/a2a-factory/create-a2a-ws-client.ts'
export * from './factories/a2a-factory/create-a2a-ws-handler.ts'
export * from './factories/a2a-factory/peers.ts'
