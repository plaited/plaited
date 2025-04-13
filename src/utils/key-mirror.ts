/**
 * Type definition for an object with mirrored key-value pairs.
 * Keys and values are identical strings, and all properties are readonly.
 *
 * @template Keys Array of string literals defining allowed keys
 *
 * @example
 * type Colors = KeyMirror<['red', 'blue', 'green']>
 * // Results in:
 * // {
 * //   readonly red: 'red'
 * //   readonly blue: 'blue'
 * //   readonly green: 'green'
 * // }
 */
export type KeyMirror<Keys extends string[]> = {
  readonly [K in Keys[number]]: K
}

/**
 * Creates an immutable object where each key matches its corresponding value.
 * Useful for creating enum-like objects or constant mappings.
 *
 * @template Keys Tuple type of string literals
 * @param inputs String values to use as both keys and values
 * @returns Frozen object with mirrored key-value pairs
 *
 * @example
 * const Colors = keyMirror('red', 'blue', 'green')
 * // Returns frozen object:
 * // {
 * //   red: 'red',
 * //   blue: 'blue',
 * //   green: 'green'
 * // }
 *
 * // TypeScript usage:
 * type ColorKey = keyof typeof Colors  // 'red' | 'blue' | 'green'
 * const color = Colors.red             // type is 'red'
 *
 * @remarks
 * - Object is frozen to prevent modifications
 * - Provides TypeScript type safety
 * - Useful for action types, event names, or other string constants
 */
export const keyMirror = <Keys extends string[]>(...inputs: Keys) => {
  const mirrored = inputs.reduce((acc, key) => ({ ...acc, [key]: key }), {} as KeyMirror<Keys>)

  return Object.freeze(mirrored)
}
