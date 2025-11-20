/**
 * Utility functions for the Plaited framework.
 * Provides general-purpose helpers for type checking, string manipulation, DOM operations, and more.
 *
 * @remarks
 * This module provides access to:
 * - **Type Checking**: {@link isTypeOf}, {@link trueTypeOf} - Runtime type validation and detection
 * - **String Utilities**: {@link case} functions, {@link htmlEscape}, {@link htmlUnescape}, {@link hashString} - String manipulation and formatting
 * - **DOM Utilities**: {@link canUseDOM}, {@link createDocumentFragment} - Browser environment detection and DOM helpers
 * - **Data Utilities**: {@link deepEqual}, {@link keyMirror}, {@link valueOf} - Object comparison and manipulation
 * - **ID Generation**: {@link ueid} - Unique identifier creation
 * - **Async Utilities**: {@link wait}, {@link noop} - Promise helpers and no-op function
 *
 * @remarks
 * All utilities are pure functions with no side effects unless explicitly documented.
 * These utilities are framework-agnostic and can be used independently of Plaited's core features.
 *
 * @see {@link https://github.com/plaited/plaited} for framework documentation
 * @since 1.0.0
 */

export * from './utils/can-use-dom.js'
export * from './utils/case.js'
export * from './utils/create-document-fragment.js'
export * from './utils/deep-equal.js'
export * from './utils/escape.js'
export * from './utils/hash-string.js'
export * from './utils/is-type-of.js'
export * from './utils/key-mirror.js'
export * from './utils/noop.js'
export * from './utils/true-type-of.js'
export * from './utils/ueid.js'
export * from './utils/value-of.type.js'
export * from './utils/wait.js'
