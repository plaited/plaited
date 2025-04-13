import { trueTypeOf } from './true-type-of.js'

/**
 * Type guard function that checks if a value matches a specified type.
 * Uses precise type checking and provides TypeScript type narrowing.
 *
 * @template T The type to narrow to if check passes
 * @param obj Value to check
 * @param type Expected type name (lowercase)
 * @returns Boolean with type predicate for TypeScript type narrowing
 *
 * @example
 * // Basic usage
 * isTypeOf<Array<unknown>>(value, 'array')  // Narrows value to Array
 * isTypeOf<Date>(value, 'date')            // Narrows value to Date
 *
 * // With control flow
 * if (isTypeOf<string>(value, 'string')) {
 *   value.toLowerCase()  // TypeScript knows value is string
 * }
 *
 * @remarks
 * - Uses trueTypeOf for accurate type detection
 * - Case sensitive, type should be lowercase
 * - Provides TypeScript type guard functionality
 * - More reliable than instanceof for built-in types
 */
export const isTypeOf = <T>(obj: unknown, type: string): obj is T => trueTypeOf(obj) === type
