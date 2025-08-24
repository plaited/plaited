/**
 * No-operation function for optional callbacks.
 * Does nothing, returns nothing.
 *
 * @template T - Argument types (inferred)
 * @param _args - Any arguments (ignored)
 * @returns void
 *
 * @example Basic usage
 * ```ts
 * noop();                    // Does nothing
 * noop('hello', 42, true);   // Ignores arguments
 * ```
 *
 * @example Optional callbacks
 * ```ts
 * type Options = {
 *   onSuccess?: (data: unknown) => void;
 *   onError?: (error: Error) => void;
 * };
 *
 * function fetchData(options: Options) {
 *   const onSuccess = options.onSuccess ?? noop;
 *   const onError = options.onError ?? noop;
 *   
 *   fetch(url)
 *     .then(onSuccess)
 *     .catch(onError);
 * }
 * ```
 *
 * @example Promise chains
 * ```ts
 * promise
 *   .then(processData)
 *   .catch(noop); // Ignore errors
 * ```
 *
 * @remarks
 * Single instance, zero allocation.
 * Use for: optional callbacks, placeholders, promise chains.
 */
export const noop = <T = never>(..._: T[]) => {}
