import type { CreateNodeOptions, NodeHandle } from '../modnet/modnet.types.ts'

/**
 * Options for bootstrapping a Plaited node.
 *
 * @public
 */
export type CreateBootstrapOptions = CreateNodeOptions

/**
 * Handle returned by {@link createBootstrap}.
 *
 * @public
 */
export type BootstrapHandle = NodeHandle
