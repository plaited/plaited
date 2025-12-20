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

export * from './utils/can-use-dom.ts'
export * from './utils/case.ts'
export * from './utils/create-document-fragment.ts'
export * from './utils/deep-equal.ts'
export * from './utils/escape.ts'
export * from './utils/hash-string.ts'
export * from './utils/is-type-of.ts'
export * from './utils/key-mirror.ts'
export * from './utils/noop.ts'
export * from './utils/true-type-of.ts'
export * from './utils/ueid.ts'
export * from './utils/value-of.type.ts'
export * from './utils/wait.ts'
