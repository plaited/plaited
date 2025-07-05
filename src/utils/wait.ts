/**
 * @internal
 * @module wait
 *
 * Purpose: Promise-based timing utilities for asynchronous flow control
 * Architecture: Thin wrapper around setTimeout with Promise interface
 * Dependencies: None - uses native Promise and setTimeout APIs
 * Consumers: Animation systems, retry logic, rate limiters, test utilities
 *
 * Maintainer Notes:
 * - Simple abstraction enables async/await syntax for delays
 * - Returns Promise<unknown> to allow flexible resolution values
 * - No timer cleanup needed as Promise resolves naturally
 * - Common pattern in modern JavaScript replacing callback-based timers
 * - Type exported separately to enable custom implementations
 * - Critical for flow control in async operations
 *
 * Common modification scenarios:
 * - Cancellable delays: Return object with cancel method using clearTimeout
 * - High-precision timing: Use performance.now() for sub-millisecond accuracy
 * - Raf-based timing: Replace setTimeout with requestAnimationFrame
 * - Progress tracking: Add optional progress callback parameter
 *
 * Performance considerations:
 * - Each call creates new Promise and timer
 * - No pooling or reuse of Promise objects
 * - Timer accuracy limited by browser/runtime (~4ms minimum)
 * - Many concurrent timers can impact performance
 *
 * Known limitations:
 * - No built-in cancellation mechanism
 * - Minimum delay varies by environment (typically 4ms)
 * - Not suitable for high-precision timing
 * - Subject to browser throttling in background tabs
 */

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
 * Creates a Promise that resolves after a specified delay.
 * Provides a clean, Promise-based alternative to setTimeout.
 *
 * @param ms - Duration to wait in milliseconds
 * @returns Promise that resolves after the specified delay
 *
 * @example
 * Basic Delay
 * ```ts
 * // Simple pause
 * await wait(1000); // Waits 1 second
 *
 * // With other async operations
 * const data = await fetch(url);
 * await wait(500); // Cool-down period
 * const moreData = await fetch(url2);
 * ```
 *
 * @example
 * Retry Logic
 * ```ts
 * async function fetchWithRetry(url: string, retries = 3) {
 *   for (let i = 0; i < retries; i++) {
 *     try {
 *       return await fetch(url);
 *     } catch (err) {
 *       if (i === retries - 1) throw err;
 *       await wait(1000 * Math.pow(2, i)); // Exponential backoff
 *     }
 *   }
 * }
 * ```
 *
 * @example
 * Animation Timing
 * ```ts
 * async function animateElement(el: HTMLElement) {
 *   el.classList.add('fade-out');
 *   await wait(300); // Wait for animation
 *   el.classList.add('hidden');
 * }
 * ```
 *
 * @example
 * Rate Limiting
 * ```ts
 * async function processItems(items: unknown[]) {
 *   for (const item of items) {
 *     await processItem(item);
 *     await wait(100); // Rate limit: 10 items per second
 *   }
 * }
 * ```
 *
 * @remarks
 * Common Use Cases:
 * - Adding delays between operations
 * - Implementation of retry logic
 * - Rate limiting API calls
 * - Animation timing
 * - Debouncing user actions
 *
 * Benefits:
 * - Promise-based for async/await syntax
 * - Non-blocking execution
 * - Cleaner than nested setTimeout
 * - Type-safe with TypeScript
 * - Useful for testing and debugging
 *
 * Best Practices:
 * 1. Use reasonable delays (100ms-3000ms typical)
 * 2. Consider exponential backoff for retries
 * 3. Add timeout handling for critical operations
 * 4. Be mindful of memory in loops
 */
export const wait: Wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
