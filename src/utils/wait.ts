/**
 * Type definition for a Promise-based delay function.
 * Represents a function that creates a time-based Promise.
 *
 * @param ms Number of milliseconds to wait
 * @returns Promise that resolves after the specified delay
 */
export type Wait = (ms: number) => Promise<unknown>
/**
 * Creates a Promise that resolves after a specified delay.
 * Utility for adding time-based delays in async operations.
 *
 * @param ms Number of milliseconds to wait
 * @returns Promise that resolves after the delay
 *
 * @example
 * // Basic delay
 * await wait(1000); // Waits 1 second
 *
 * // In async function
 * async function fetchWithRetry() {
 *   try {
 *     return await fetch(url);
 *   } catch {
 *     await wait(1000); // Wait before retry
 *     return fetch(url);
 *   }
 * }
 *
 * // With animation
 * async function animate() {
 *   element.classList.add('fade');
 *   await wait(500); // Wait for animation
 *   element.remove();
 * }
 *
 * @remarks
 * - Non-blocking delay using Promise
 * - Useful for throttling, debouncing, or adding delays
 * - More readable than nested setTimeout
 * - Can be used with async/await syntax
 */
export const wait: Wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
