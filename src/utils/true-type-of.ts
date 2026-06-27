/**
 * Precise type detection beyond typeof operator.
 * Returns lowercase string of actual JavaScript type.
 *
 * @param obj - Value to check
 * @returns Lowercase type string
 *
 * @remarks
 * More accurate than typeof. Detects: string, number, boolean, null,
 * undefined, symbol, bigint, array, object, date, regexp, map, set,
 * function, asyncfunction, generatorfunction.
 *
 * @see {@link isTypeOf} for type guard usage
 */
export const trueTypeOf = (obj?: unknown): string => Object.prototype.toString.call(obj).slice(8, -1).toLowerCase()
