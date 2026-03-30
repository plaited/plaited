/**
 * Transitional options for bootstrapping a Plaited node.
 *
 * @remarks
 * The previous `modnet`-backed bootstrap path has been removed. The concrete
 * bootstrap composition will be rebuilt directly around `create-agent`,
 * `createServer`, and executable factories.
 *
 * @public
 */
export type CreateBootstrapOptions = Record<string, unknown>

/**
 * Transitional handle returned by {@link createBootstrap}.
 *
 * @public
 */
export type BootstrapHandle = unknown
