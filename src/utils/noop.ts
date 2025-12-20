/**
 * No-operation function for optional callbacks.
 * Does nothing, returns nothing.
 *
 * @template T - Argument types (inferred)
 * @param _args - Any arguments (ignored)
 * @returns void
 *
 * @remarks
 * Single instance, zero allocation.
 * Use for: optional callbacks, placeholders, promise chains.
 */
export const noop = <T = never>(..._: T[]) => {}
