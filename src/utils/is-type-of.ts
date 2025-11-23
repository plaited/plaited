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
 * @example String guard
 * ```ts
 * const value: unknown = "test";
 * if (isTypeOf<string>(value, 'string')) {
 *   value.toUpperCase(); // TypeScript knows it's string
 * }
 * ```
 *
 * @example Array guard
 * ```ts
 * const data: unknown = [1, 2, 3];
 * if (isTypeOf<Array<number>>(data, 'array')) {
 *   data.forEach(n => n); // TypeScript knows it's array
 * }
 * ```
 *
 * @example Type switching
 * ```ts
 * function process(val: unknown) {
 *   if (isTypeOf<string>(val, 'string')) return val.trim();
 *   if (isTypeOf<number>(val, 'number')) return val.toFixed(2);
 *   if (isTypeOf<Date>(val, 'date')) return val.toISOString();
 * }
 * ```
 *
 * @remarks
 * Supports: primitives, objects, arrays, dates, maps, sets, functions.
 * Uses trueTypeOf for accuracy.
 *
 * @see {@link trueTypeOf} for type detection
 */
export const isTypeOf = <T>(obj: unknown, type: string): obj is T => trueTypeOf(obj) === type
