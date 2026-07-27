/**
 * Type definition for an object with mirrored key-value pairs.
 * Each key is a string literal that matches its corresponding value.
 *
 * @template Keys - Array of string literals defining the allowed keys
 */
export type KeyMirror<Keys extends string[]> = {
  /**
   * @internal
   * Mapped type that creates object type with self-referential key-value pairs.
   * - Keys[number] extracts union type from tuple
   * - K in ... iterates each union member
   * - readonly prevents type-level mutations
   */
  readonly [K in Keys[number]]: K
}

/**
 * Creates immutable object with self-referential key-value pairs.
 * Type-safe string constants for TypeScript.
 *
 * @template Keys - String literal tuple
 * @param inputs - Strings to use as keys and values
 * @returns Frozen object where each key equals its value
 *
 * @remarks
 * Prevents typos, enables autocompletion.
 * Object is frozen (immutable).
 * Perfect for Redux actions, event names, enums.
 *
 * @see {@link trueTypeOf} for runtime type checking
 */
export const keyMirror = <Keys extends string[]>(...inputs: Keys) => {
  /**
   * @internal
   * Build object where each key maps to itself using reduce.
   * - Rest parameter allows clean API: keyMirror('A', 'B', 'C')
   * - Spread in reducer creates new object each iteration
   * - Type assertion preserves literal types through reduction
   */
  const mirrored = inputs.reduce((acc, key) => ({ ...acc, [key]: key }), {} as KeyMirror<Keys>)

  /**
   * @internal
   * Freeze the object to prevent runtime mutations.
   * This ensures constants remain constant throughout application lifecycle.
   */
  return Object.freeze(mirrored)
}
