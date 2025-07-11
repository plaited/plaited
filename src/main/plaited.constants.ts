import { keyMirror } from '../utils.js'

/**
 * @internal Mirrored object of lifecycle and mutation callback names for Plaited elements.
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
 *
 * @example
 * Using lifecycle callbacks in a component
 * ```tsx
 * const MyElement = bElement({
 *   tag: 'my-element',
 *   shadowDom: (
 *     <div>
 *       <slot p-target="content" />
 *       <p p-target="status">Status: Waiting</p>
 *     </div>
 *   ),
 *   bProgram({ $, trigger }) {
 *     const [status] = $('status');
 *
 *     return {
 *       [ELEMENT_CALLBACKS.onConnected]() {
 *         status.render('Status: Connected');
 *       },
 *       [ELEMENT_CALLBACKS.onDisconnected]() {
 *         console.log('Cleanup tasks');
 *       }
 *     };
 *   }
 * });
 * ```
 *
 * @example
 * Form association callbacks
 * ```tsx
 * const FormField = bElement({
 *   tag: 'form-field',
 *   formAssociated: true,
 *   shadowDom: (
 *     <div>
 *       <input p-target="input" type="text" />
 *       <span p-target="state" />
 *     </div>
 *   ),
 *   bProgram({ $, internals }) {
 *     const [state] = $('state');
 *
 *     return {
 *       [ELEMENT_CALLBACKS.onFormAssociated]({ form }) {
 *         state.render(`Associated with: ${form.id}`);
 *       },
 *       [ELEMENT_CALLBACKS.onFormDisabled]({ disabled }) {
 *         state.render(`Field ${disabled ? 'disabled' : 'enabled'}`);
 *       }
 *     };
 *   }
 * });
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
 * @example
 * Creating a template validator
 * ```tsx
 * const isPlaitedTemplate = (obj: unknown): obj is TemplateObject =>
 *   obj && typeof obj === 'object' && obj.$ === PLAITED_TEMPLATE_IDENTIFIER;
 *
 * const template = <div>Hello World</div>;
 * console.log(isPlaitedTemplate(template)); // true
 * console.log(isPlaitedTemplate({ html: [], $: '🐻' })); // false
 * ```
 *
 * @remarks
 * - Do not attempt to create template objects manually
 * - Always use JSX or the `h` function to create templates
 * - The identifier is read-only and cannot be modified
 * - Used internally by the framework's template processing
 */
export const PLAITED_TEMPLATE_IDENTIFIER = '🐻' as const
