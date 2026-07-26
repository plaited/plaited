/**
 * Utility functions for the Plaited framework.
 * Provides general-purpose helpers for type checking, string manipulation, and more.
 *
 * @remarks
 * This module provides access to:
 * - **Type Checking**: {@link isTypeOf}, {@link trueTypeOf} - Runtime type validation and detection
 * - **Data Utilities**: {@link keyMirror} - Object key mirroring, {@link deepEqual} - Deep equality
 *
 * @remarks
 * All utilities are pure functions with no side effects unless explicitly documented.
 * These utilities are framework-agnostic and can be used independently of Plaited's core features.
 *
 * @see {@link https://github.com/plaited/plaited} for framework documentation
 * @since 1.0.0
 */

export * from './src/utils/deep-equal.ts'
export * from './src/utils/is-type-of.ts'
export * from './src/utils/key-mirror.ts'
export * from './src/utils/true-type-of.ts'
