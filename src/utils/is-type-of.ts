import { trueTypeOf } from './true-type-of.js'

/**
 * Type guard function that checks if a value matches a specified type.
 * Uses precise type checking and provides TypeScript type narrowing.
 *
 * @template T - The type to check against and narrow to (e.g., string, Array<unknown>, Date)
 * @param obj - Any value to type check
 * @param type - Type name in lowercase (e.g., 'string', 'array', 'date')
 * @returns Type predicate indicating if value matches specified type
 *
 * @remarks
 * Supported Types:
 * - Primitives: 'string', 'number', 'boolean', 'undefined', 'null', 'symbol', 'bigint'
 * - Objects: 'object', 'array', 'date', 'regexp', 'map', 'set'
 * - Functions: 'function', 'asyncfunction', 'generatorfunction'
 *
 * Features:
 * - TypeScript type guard integration
 * - Precise type detection via trueTypeOf
 * - Case-sensitive type names (always lowercase)
 * - More reliable than instanceof checks
 * - Works with built-in types and primitives
 *
 * @example
 * Type Checking Primitives
 * ```ts
 * const value: unknown = "test";
 *
 * if (isTypeOf<string>(value, 'string')) {
 *   console.log(value.toUpperCase()); // TypeScript knows value is string
 * }
 * ```
 *
 * @example
 * Array Type Guards
 * ```ts
 * const data: unknown = [1, 2, 3];
 *
 * if (isTypeOf<Array<unknown>>(data, 'array')) {
 *   data.forEach(item => console.log(item)); // TypeScript knows data is array
 * }
 * ```
 *
 * @example
 * Object Type Checking
 * ```ts
 * const obj: unknown = new Date();
 *
 * if (isTypeOf<Date>(obj, 'date')) {
 *   console.log(obj.toISOString()); // TypeScript knows obj is Date
 * }
 * ```
 *
 * @example
 * Multiple Type Checks
 * ```ts
 * function processValue(val: unknown) {
 *   if (isTypeOf<string>(val, 'string')) {
 *     return val.trim();
 *   } else if (isTypeOf<number>(val, 'number')) {
 *     return val.toFixed(2);
 *   } else if (isTypeOf<Date>(val, 'date')) {
 *     return val.toISOString();
 *   }
 *   throw new Error('Unsupported type');
 * }
 * ```
 */
export const isTypeOf = <T>(obj: unknown, type: string): obj is T => trueTypeOf(obj) === type
