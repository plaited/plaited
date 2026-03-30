/**
 * Runtime primitives for PM-mediated actor coordination.
 *
 * @remarks
 * This module introduces the transport-neutral communication layer used by
 * behavioral actors. Structural MSS objects remain distinct from runtime
 * actors and concrete artifacts.
 *
 * @public
 */

export * from './create-link.ts'
export * from './runtime.constants.ts'
export * from './runtime.schemas.ts'
export type * from './runtime.types.ts'
