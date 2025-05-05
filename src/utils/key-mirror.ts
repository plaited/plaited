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
 * @throws {TypeError} When inputs contain non-string values
 */
export const keyMirror = <Keys extends string[]>(...inputs: Keys) => {
  const mirrored = inputs.reduce((acc, key) => ({ ...acc, [key]: key }), {} as KeyMirror<Keys>)

  return Object.freeze(mirrored)
}
