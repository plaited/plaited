import { trueTypeOf } from './true-type-of.js'
/**
 * Creates a function that calls multiple functions sequentially with the same arguments.
 * Safely handles non-function values by skipping them.
 *
 * Features:
 * - Type-safe function composition
 * - Preserves argument types
 * - Handles invalid functions gracefully
 * - Maintains original function signatures
 *
 * @template F Function type with inferred parameters and return type
 * @param fns Array of functions to be called
 * @returns Combined function that accepts the same parameters as the input functions
 *
 * @example
 * // Basic usage
 * const combined = useCallAll(
 *   (x: number) => console.log(x),
 *   (x: number) => alert(x)
 * );
 * combined(42); // Logs and alerts '42'
 *
 * // With event handlers
 * const handleClick = useCallAll(
 *   props.onClick,
 *   localClickHandler,
 *   analytics.trackClick
 * );
 *
 * // Safely handles nulls
 * const safe = useCallAll(
 *   undefined,
 *   null,
 *   (x: number) => console.log(x)
 * ); // Only valid function is called
 *
 * @remarks
 * - Functions are called in the order they are provided
 * - Return values are ignored
 * - Invalid functions (null, undefined, non-functions) are skipped
 * - Useful for combining multiple event handlers or callbacks
 */
export const useCallAll =
  <F extends (...args: Parameters<F>) => ReturnType<F>>(...fns: F[]) =>
  (...args: Parameters<F>) => {
    for (const fn of fns) {
      if (trueTypeOf(fn) === 'function') fn(...args)
    }
  }
