/**
 * Modnet topology module — node roles, metadata conventions, and
 * modnet-specific extensions to the A2A protocol.
 *
 * @remarks
 * Modnet is the multi-node topology built on A2A. This module contains
 * constants and utilities specific to the modnet architecture that
 * don't belong in the protocol-pure `a2a/` module.
 *
 * @public
 */

export * from './modnet/modnet.constants.ts'
export * from './modnet/modnet.utils.ts'
export * from './modnet/node.ts'
export type * from './modnet/node.types.ts'
