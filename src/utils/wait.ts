
/**
 * Type definition for a Promise-based delay function.
 * Provides type safety for time-based Promise creation.
 *
 * @param ms - Duration to wait in milliseconds
 * @returns Promise that resolves to unknown after the delay
 *
 * @example
 * Type Usage
 * ```ts
 * const customWait: Wait = ms =>
 *   new Promise(resolve => requestAnimationFrame(() => setTimeout(resolve, ms)));
 * ```
 */
export type Wait = (ms: number) => Promise<unknown>

/**
 * Promise-based delay utility for async flow control.
 * Cleaner alternative to setTimeout.
 *
 * @param ms - Milliseconds to wait
 * @returns Promise resolving after delay
 *
 * @example Basic delay
 * ```ts
 * await wait(1000); // Wait 1 second
 * await wait(500);  // Wait 500ms
 * ```
 *
 * @example Retry with backoff
 * ```ts
 * for (let i = 0; i < retries; i++) {
 *   try {
 *     return await fetch(url);
 *   } catch (err) {
 *     if (i === retries - 1) throw err;
 *     await wait(1000 * Math.pow(2, i));
 *   }
 * }
 * ```
 *
 * @example Rate limiting
 * ```ts
 * for (const item of items) {
 *   await process(item);
 *   await wait(100); // 10 items/second
 * }
 * ```
 *
 * @remarks
 * Non-blocking, works with async/await.
 * Min delay ~4ms (browser limitation).
 * Use for: retries, rate limiting, animations.
 */
export const wait: Wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
