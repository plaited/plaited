/**
 * No-operation (no-op) function that does nothing and returns nothing.
 * Useful as a default callback, stub, or placeholder function.
 *
 * Features:
 * - Accepts any number of arguments (typed via generic)
 * - Type-safe with TypeScript
 * - Zero impact on memory/performance
 * - Void return type
 *
 * @template T Type of parameters (defaults to never)
 * @param _args Optional arguments (ignored)
 * @returns void
 *
 * @example
 * // As a default callback
 * const callback = props.onChange ?? noop;
 *
 * @remarks
 * Prefer this over empty arrow functions or undefined checks
 * for better performance and cleaner code
 */
export const noop = <T = never>(..._: T[]) => {}
