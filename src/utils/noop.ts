/**
 * No-operation (no-op) function that does nothing and returns nothing.
 * Provides a type-safe way to handle optional callbacks or placeholder functions.
 *
 * @template T - The common type of the arguments passed to `noop`. This is typically inferred by TypeScript
 *               based on the arguments provided at the call site. If no arguments are given, or if
 *               explicitly set to `never` (the default), it signifies no specific argument types are expected.
 * @param _args - Accepts any number of arguments. These arguments are ignored by the function.
 *                Their types are captured by `T[]`.
 * @returns void - Always returns `undefined`.
 *
 * Features:
 * - Zero memory/performance impact
 * - Type-safe parameter handling
 * - Accepts any number of arguments
 * - Consistent void return type
 *
 *
 * @example
 * Basic Usage:
 * ```ts
 * noop(); // Does nothing
 * noop('hello', 42, true); // Arguments are accepted but ignored
 * ```
 *
 * @example
 * Optional Callbacks:
 * ```ts
 * interface Options {
 *   onSuccess?: (data: unknown) => void;
 *   onError?: (error: Error) => void;
 * }
 *
 * function fetchData(options: Options) {
 *   const onSuccess = options.onSuccess ?? noop;
 *   const onError = options.onError ?? noop;
 *
 *   fetch('/api/data')
 *     .then(res => res.json())
 *     .then(onSuccess)
 *     .catch(onError);
 * }
 *
 * fetchData({ onSuccess: data => console.log('Data:', data) });
 * fetchData({}); // Uses noop for missing callbacks
 * ```
 *
 * @example
 * Promise Error Handling:
 * ```ts
 * Promise.resolve()
 *   .then(result => { /* process data */ })
 *   .catch(noop); // Safely ignore potential errors if no specific handling is needed
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
