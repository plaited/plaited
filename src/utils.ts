/**
 * Utility functions for the Plaited framework.
 * Provides general-purpose helpers for type checking, string manipulation, and more.
 *
 * @remarks
 * This module provides access to:
 * - **Type Checking**: {@link isTypeOf}, {@link trueTypeOf} - Runtime type validation and detection
 * - **String Utilities**: {@link case} functions, {@link htmlEscape}, {@link htmlUnescape} - String manipulation and formatting
 * - **Data Utilities**: {@link keyMirror} - Object key mirroring
 *
 * @remarks
 * All utilities are pure functions with no side effects unless explicitly documented.
 * These utilities are framework-agnostic and can be used independently of Plaited's core features.
 *
 * @see {@link https://github.com/plaited/plaited} for framework documentation
 * @since 1.0.0
 */

export * from './utils/case.ts'
export * from './utils/escape.ts'
export * from './utils/is-type-of.ts'
export * from './utils/key-mirror.ts'
export * from './utils/true-type-of.ts'
