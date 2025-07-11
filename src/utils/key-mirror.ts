/**
 * @internal
 * @module key-mirror
 *
 * Purpose: Type-safe string constant generation for reducing magic strings
 * Architecture: Immutable object factory with TypeScript mapped types
 * Dependencies: None - pure TypeScript/JavaScript
 * Consumers: Event systems, state management, API constants, CSS class names
 *
 * Maintainer Notes:
 * - This utility prevents typos and enables refactoring of string constants
 * - Object.freeze ensures true immutability at runtime
 * - Mapped type preserves literal types for maximum type safety
 * - Reduce with spread creates new object each iteration (intentional for immutability)
 * - Common pattern from React/Redux ecosystem adapted for general use
 *
 * Common modification scenarios:
 * - Nested constants: Create hierarchical structure with nested keyMirror calls
 * - Prefixed keys: Add prefix parameter for namespacing
 * - Value transformation: Allow custom value mapping function
 * - Symbol support: Extend to support Symbol keys
 *
 * Performance considerations:
 * - Object spread in reduce creates O(n²) allocations
 * - For large constant sets, consider Object.fromEntries
 * - Frozen objects have slight property access overhead
 * - Type computation happens at compile time only
 *
 * Known limitations:
 * - Only supports string keys and values
 * - No runtime validation of string types
 * - Cannot create numeric or symbol constants
 * - Frozen object prevents runtime modification
 */

/**
 * Type definition for an object with mirrored key-value pairs.
 * Each key is a string literal that matches its corresponding value.
 *
 * @template Keys - Array of string literals defining the allowed keys
 *
 * @example
 * Type Definition
 * ```ts
 * type Actions = KeyMirror<['CREATE', 'UPDATE', 'DELETE']>;
 * // Results in:
 * // {
 * //   readonly CREATE: 'CREATE'
 * //   readonly UPDATE: 'UPDATE'
 * //   readonly DELETE: 'DELETE'
 * // }
 * ```
 *
 * @example
 * With Union Types
 * ```ts
 * type Status = 'pending' | 'active' | 'completed';
 * type StatusMap = KeyMirror<[Status]>;
 * ```
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
 * Creates an immutable object where keys mirror their values, providing type-safe
 * string constants for use in TypeScript applications.
 *
 * @template Keys - Tuple type of string literals
 * @param inputs - String values to use as both keys and values
 * @returns A frozen object where each key equals its value
 *
 * @example
 * Basic Usage
 * ```ts
 * const ActionTypes = keyMirror('CREATE', 'UPDATE', 'DELETE');
 * console.log(ActionTypes.CREATE); // 'CREATE'
 * ActionTypes.CREATE = 'MODIFY'; // Error: cannot modify frozen object
 * ```
 *
 * @example
 * With Type Safety
 * ```ts
 * function handleAction(type: keyof typeof ActionTypes) {
 *   switch (type) {
 *     case ActionTypes.CREATE: return 'Creating...';
 *     case ActionTypes.UPDATE: return 'Updating...';
 *     case ActionTypes.DELETE: return 'Deleting...';
 *   }
 * }
 * ```
 *
 * @example
 * Redux-style Actions
 * ```ts
 * const TodoActions = keyMirror(
 *   'ADD_TODO',
 *   'TOGGLE_TODO',
 *   'SET_VISIBILITY'
 * );
 *
 * dispatch({
 *   type: TodoActions.ADD_TODO,
 *   payload: { text: 'Learn TypeScript' }
 * });
 * ```
 *
 * @example
 * Event Constants
 * ```ts
 * const Events = keyMirror(
 *   'click',
 *   'mouseenter',
 *   'mouseleave'
 * );
 *
 * element.addEventListener(Events.click, () => {
 *   // TypeScript knows Events.click is 'click'
 * });
 * ```
 *
 * @remarks
 * Key Features:
 * - Creates immutable constant mappings
 * - Provides TypeScript type safety
 * - Prevents typos in string literals
 * - Enables IDE autocompletion
 * - Useful for:
 *   - Redux action types
 *   - Event name constants
 *   - Enum-like objects
 *   - State machine transitions
 *   - API endpoint mappings
 *
 * @remarks If non-string inputs are provided in a JavaScript context (bypassing TypeScript),
 *          the behavior is undefined and may lead to unexpected object keys or runtime errors
 *          during the reduce operation. TypeScript should prevent this at compile time.
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
