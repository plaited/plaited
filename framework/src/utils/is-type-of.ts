import { trueTypeOf } from './true-type-of.ts'

/**
 * Type guard for precise type checking with TypeScript narrowing.
 * More reliable than typeof or instanceof.
 *
 * @template T - Type to narrow to
 * @param obj - Value to check
 * @param type - Lowercase type name
 * @returns Type predicate for narrowing
 *
 * @remarks
 * Supports: primitives, objects, arrays, dates, maps, sets, functions.
 * Uses trueTypeOf for accuracy.
 *
 * @see {@link trueTypeOf} for type detection
 */
export const isTypeOf = <T>(obj: unknown, type: string): obj is T => trueTypeOf(obj) === type
