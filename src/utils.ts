/**
 * Plaited Utilities
 *
 * A collection of essential utility functions for web development, providing
 * type-safe helpers for common operations.
 *
 * @packageDocumentation
 *
 * Core Categories:
 * - DOM Utilities ({@link canUseDOM})
 * - Type Checking ({@link isTypeOf}, {@link trueTypeOf})
 * - String Manipulation ({@link escape}, {@link unescape})
 * - Data Structure Utilities ({@link deepEqual}, {@link hashString})
 * - Event Handling ({@link DelegatedListener})
 * - Unique Identifiers ({@link ueid})
 *
 * @example
 * Type Checking
 * ```ts
 * import { isTypeOf, trueTypeOf } from 'plaited/utils'
 *
 * // Type guard with TypeScript support
 * const value: unknown = ['test']
 * if (isTypeOf<string[]>(value, 'array')) {
 *   value.join(',') // TypeScript knows value is array
 * }
 *
 * // Precise type detection
 * console.log(trueTypeOf(new Set())) // 'set'
 * ```
 *
 * @example
 * DOM Safety
 * ```ts
 * import { canUseDOM, escape } from 'plaited/utils'
 *
 * if (canUseDOM()) {
 *   // Safe to use DOM APIs
 *   document.body.innerHTML = escape('<script>alert("xss")</script>')
 * }
 * ```
 *
 * @example
 * Data Comparison
 * ```ts
 * import { deepEqual } from 'plaited/utils'
 *
 * const obj1 = { nested: { array: [1, 2, 3] } }
 * const obj2 = { nested: { array: [1, 2, 3] } }
 * console.log(deepEqual(obj1, obj2)) // true
 * ```
 *
 * @example
 * Event Delegation
 * ```ts
 * import { DelegatedListener } from 'plaited/utils'
 *
 * const delegate = new DelegatedListener((event) => {
 *   console.log('Event handled:', event.type)
 * })
 * element.addEventListener('click', delegate)
 * ```
 *
 * @remarks
 * Key Features:
 * - TypeScript-first design with strong type safety
 * - Isomorphic utilities that work in any environment
 * - Performance-optimized implementations
 * - Comprehensive test coverage
 * - Zero dependencies
 *
 * Import Categories:
 * 1. Environment Detection
 *    - canUseDOM: Browser environment detection
 *
 * 2. Type System
 *    - isTypeOf: Type guard with generics
 *    - trueTypeOf: Precise type detection
 *
 * 3. String Processing
 *    - escape/unescape: HTML entity handling
 *    - hashString: String hashing
 *    - case utilities: String case conversion
 *
 * 4. Data Utilities
 *    - deepEqual: Deep equality comparison
 *    - keyMirror: Enum-like object creation
 *    - noop: No-operation function
 *
 * 5. Async Utilities
 *    - wait: Promise-based delay
 *
 * 6. DOM Utilities
 *    - DelegatedListener: Event delegation
 *    - ueid: Unique element ID generation
 */

export * from './utils/can-use-dom.js'
export * from './utils/case.js'
export * from './utils/deep-equal.js'
export * from './utils/delegated-listener.js'
export * from './utils/escape.js'
export * from './utils/hash-string.js'
export * from './utils/is-type-of.js'
export * from './utils/key-mirror.js'
export * from './utils/noop.js'
export * from './utils/true-type-of.js'
export * from './utils/ueid.js'
export * from './utils/wait.js'
