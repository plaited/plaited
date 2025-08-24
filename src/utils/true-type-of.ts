/**
 * Precise type detection beyond typeof operator.
 * Returns lowercase string of actual JavaScript type.
 *
 * @param obj - Value to check
 * @returns Lowercase type string
 *
 * @example Basic types
 * ```ts
 * trueTypeOf('hello');      // 'string'
 * trueTypeOf(42);          // 'number'
 * trueTypeOf(null);        // 'null'
 * trueTypeOf(undefined);   // 'undefined'
 * ```
 *
 * @example Collections and objects
 * ```ts
 * trueTypeOf([]);          // 'array'
 * trueTypeOf({});          // 'object'
 * trueTypeOf(new Map());   // 'map'
 * trueTypeOf(new Date());  // 'date'
 * ```
 *
 * @example Type switching
 * ```ts
 * switch (trueTypeOf(value)) {
 *   case 'string': return value.toLowerCase();
 *   case 'array': return value.length;
 *   case 'date': return value.toISOString();
 * }
 * ```
 *
 * @remarks
 * More accurate than typeof. Detects: string, number, boolean, null,
 * undefined, symbol, bigint, array, object, date, regexp, map, set,
 * function, asyncfunction, generatorfunction.
 *
 * @see {@link isTypeOf} for type guard usage
 */
export const trueTypeOf = (obj?: unknown): string => Object.prototype.toString.call(obj).slice(8, -1).toLowerCase()
