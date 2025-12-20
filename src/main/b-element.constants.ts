import { keyMirror } from '../utils.ts'

/**
 * @internal Mirrored object of lifecycle and mutation callback names for Behavioral elements.
 * Provides strongly typed string literals for every supported callback in a Plaited component.
 *
 * Lifecycle Callbacks:
 * - onAdopted: Element is moved to new document
 * - onAttributeChanged: Element attribute changes
 * - onConnected: Element is added to DOM
 * - onDisconnected: Element is removed from DOM
 *
 * Form-associated Callbacks:
 * - onFormAssociated: Element is associated with form
 * - onFormDisabled: Associated form is disabled
 * - onFormReset: Associated form is reset
 * - onFormStateRestore: Form state is restored
 */
export const ELEMENT_CALLBACKS = keyMirror(
  'onAdopted',
  'onAttributeChanged',
  'onConnected',
  'onDisconnected',
  'onFormAssociated',
  'onFormDisabled',
  'onFormReset',
  'onFormStateRestore',
)

/**
 * @internal Unique identifier for Plaited template objects.
 * Used internally to distinguish template objects from other values during rendering and processing.
 *
 * This constant:
 * - Acts as a type guard for template objects
 * - Facilitates safe template composition
 * - Prevents template object spoofing
 * - Used by the rendering system to identify valid templates
 *
 * @remarks
 * - Do not attempt to create template objects manually
 * - Always use JSX or the `h` function to create templates
 * - The identifier is read-only and cannot be modified
 * - Used internally by the framework's template processing
 */
export const BEHAVIORAL_TEMPLATE_IDENTIFIER = '🐻' as const
