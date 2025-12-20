/**
 * Extracts the type of values from an object type.
 * Creates a union type of all possible value types in an object.
 *
 * @template T - Object type to extract values from
 *
 * @remarks
 * - Useful for working with object values in generic contexts
 * - Preserves literal types when used with 'as const'
 * - Similar to built-in Pick but for values instead of properties
 */
export type ValueOf<T> = T[keyof T]
