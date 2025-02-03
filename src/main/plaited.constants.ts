import { keyMirror } from '../utils/key-mirror.js'

/**
 * Mirrored object of lifecycle and mutation callback names for Plaited elements.
 *
 * Lifecycle callbacks:
 * - onAdopted: Element is moved to new document
 * - onAttributeChanged: Element attribute changes
 * - onConnected: Element is added to DOM
 * - onDisconnected: Element is removed from DOM
 *
 * Form-associated callbacks:
 * - onFormAssociated: Element is associated with form
 * - onFormDisabled: Associated form is disabled
 * - onFormReset: Associated form is reset
 * - onFormStateRestore: Form state is restored
 *
 * DOM mutation callbacks:
 * - onReplaceChildren: Slotted Children are replaced
 * - onPrepend: Slotted Content prepended
 * - onAppend: Slotted Content appended
 *
 * @type {{ [K in typeof callbackNames[number]]: K }}
 *
 * @example
 * ```ts
 * ELEMENT_CALLBACKS.onConnected    // 'onConnected'
 * ELEMENT_CALLBACKS.onDisconnected // 'onDisconnected'
 * ```
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
  'onReplaceChildren',
  'onPrepend',
  'onAppend',
)
/**
 * Unique identifier for Plaited template objects.
 * Used to distinguish template objects from other values.
 *
 * @type {const} Bear emoji as literal type
 *
 * @example
 * ```ts
 * const isTemplate = (obj: unknown) =>
 *   obj && typeof obj === 'object' &&
 *   obj.$ === PLAITED_TEMPLATE_IDENTIFIER;
 * ```
 *
 * @remarks
 * - Used internally for type checking
 * - Provides unique runtime identification
 * - Constant value prevents accidental modification
 */
export const PLAITED_TEMPLATE_IDENTIFIER = '🐻' as const
