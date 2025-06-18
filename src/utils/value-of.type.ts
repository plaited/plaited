/**
 * Extracts the type of values from an object type.
 * Creates a union type of all possible value types in an object.
 *
 * @template T Object type to extract values from
 * @returns Union type of all possible value types in T
 *
 * @example
 * // Object with different value types
 * type Config = {
 *   name: string;
 *   age: number;
 *   active: boolean;
 * }
 *
 * type ConfigValue = ValueOf<Config>
 * // Results in: string | number | boolean
 *
 * // With constant objects
 * const COLORS = {
 *   red: '#ff0000',
 *   blue: '#0000ff'
 * } as const
 *
 * type ColorValue = ValueOf<typeof COLORS>
 * // Results in: '#ff0000' | '#0000ff'
 *
 * @remarks
 * - Useful for working with object values in generic contexts
 * - Preserves literal types when used with 'as const'
 * - Similar to built-in Pick but for values instead of properties
 */
export type ValueOf<T> = T[keyof T]
