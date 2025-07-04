import type { PlaitedElement, PlaitedTemplate } from './plaited.types'
import { isTypeOf } from '../utils.js'
import type { FunctionTemplate } from './jsx.types.js'
import { PLAITED_TEMPLATE_IDENTIFIER } from './plaited.constants.js'

/**
 * Type guard to identify Plaited custom elements.
 * Useful when working with DOM elements that might be Plaited components.
 *
 * @param el - Element to check
 * @returns True if element is a Plaited custom element
 *
 * @example Enhancing existing elements conditionally
 * ```tsx
 * const ComponentWrapper = defineElement({
 *   tag: 'component-wrapper',
 *   shadowDom: <slot p-target="content"  p-trigger={{slotchange: 'enhanceChildren'}}/>,
 *   bProgram({ $, trigger }) {
 *     const [content] = $('content');
 *
 *     const ;
 *
 *     return {
 *       enhanceChildren = () => {
 *       const children = content.assignedElements();
 *       children.forEach(child => {
 *         if (isPlaitedElement(child)) {
 *           // Can safely use Plaited features
 *           child.trigger({
 *             type: 'PARENT_CONNECTED',
 *             detail: { parentId: 'wrapper' }
 *           });
 *         } else {
 *           console.log('Regular element:', child.tagName);
 *         }
 *       });
 *     }
 *   }
 * });
 *
 * // Usage
 * <ComponentWrapper>
 *   <my-plaited-element />
 *   <div>Regular element</div>
 * </ComponentWrapper>
 * ```
 *
 * @remarks
 * - Returns true only for elements that inherit from HTMLElement and implement the Plaited interface
 * - Type guard ensures TypeScript correctly narrows the type for trigger and other Plaited features
 * - Useful in mixed DOM environments where both Plaited and regular elements exist
 */
export const isPlaitedElement = (el: unknown): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && Object.hasOwn(el, 'trigger')

/**
 * Type guard to identify Plaited template functions.
 * Used to verify that a function template was created by the Plaited framework.
 *
 * @param template - The function template to check
 * @returns True if the template is a valid Plaited template function
 *
 * @remarks
 * - Checks both type structure and the presence of Plaited's unique identifier
 * - Used internally by the framework to ensure template safety
 * - Helps prevent injection of invalid or malicious templates
 * - Type guard provides TypeScript type narrowing
 */
export const isPlaitedTemplateFunction = (template: FunctionTemplate): template is PlaitedTemplate =>
  isTypeOf<PlaitedTemplate>(template, 'object') && template.$ === PLAITED_TEMPLATE_IDENTIFIER
