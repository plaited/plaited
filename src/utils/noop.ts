/**
 * No-operation (no-op) function that does nothing and returns nothing.
 * Provides a type-safe way to handle optional callbacks or placeholder functions.
 *
 * @template T - Type of parameters (defaults to never)
 * @param _args - Optional arguments of type T (ignored)
 * @returns void
 *
 * Features:
 * - Zero memory/performance impact
 * - Type-safe parameter handling
 * - Accepts any number of arguments
 * - Consistent void return type
 *
 *
 * @example
 * Typed Parameters
 * ```ts
 * // With specific parameter types
 * const typedNoop = noop<[string, number]>;
 * typedNoop("test", 123); // Type-safe
 * ```
 *
 * @example
 * Promise Callbacks
 * ```ts
 * Promise.resolve()
 *   .then(result => processData(result))
 *   .catch(noop); // Safely ignore errors
 * ```
 *
 * @remarks
 * Best Practices:
 * - Use instead of empty arrow functions
 * - Prefer over undefined checks
 * - Ideal for optional callback props
 * - Perfect for event handler placeholders
 * - Useful in promise chains
 *
 * Performance Benefits:
 * - Single function instance
 * - No memory allocation per call
 * - No conditional checks needed
 * - Optimized by JS engines
 */
export const noop = <T = never>(..._: T[]) => {}
