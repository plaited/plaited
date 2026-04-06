import type { Factory } from '../../agent.ts'

/**
 * Placeholder factory surface for continual eval and bounded self-improvement.
 *
 * @public
 */
export const autoresearchFactory: Factory = () => ({})

/**
 * Creates the base autoresearch-factory scaffold.
 *
 * @public
 */
export const createAutoresearchFactory = (): Factory => autoresearchFactory
