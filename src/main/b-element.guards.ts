/**
 * @internal
 * @module plaited.guards
 *
 * Purpose: Runtime type guards for safe identification of Plaited components and templates
 * Architecture: Type predicate functions using structural checking and unique identifiers
 * Dependencies: isTypeOf utility, Plaited type definitions, constants
 * Consumers: Component factories, template renderers, DOM utilities, event systems
 *
 * Maintainer Notes:
 * - Type guards provide runtime safety for dynamic component handling
 * - isBehavioralElement checks for trigger method (unique to Behavioral elements)
 * - isBehavioralTemplateFunction uses unique identifier to prevent spoofing
 * - Both guards narrow TypeScript types for better type inference
 * - Critical for safe interop between Plaited and regular DOM elements
 * - Used extensively in mixed component environments
 *
 * Common modification scenarios:
 * - Adding new element capabilities: Update isBehavioralElement checks
 * - Supporting element versioning: Add version property checks
 * - Custom element detection: Create specialized guards for element types
 * - Performance optimization: Cache guard results for repeated checks
 *
 * Performance considerations:
 * - Object.hasOwn is faster than 'in' operator
 * - Type checks are performed at runtime on each call
 * - No caching of results - guards are stateless
 * - Minimal overhead but called frequently in DOM operations
 *
 * Known limitations:
 * - Cannot detect Behavioral elements before upgrade
 * - Relies on structural typing (duck typing)
 * - No versioning support for element API changes
 * - Spoofable by adding trigger method to regular elements
 */

import type { BehavioralElement, BehavioralTemplate } from './b-element.types'
import { isTypeOf } from '../utils.js'
import type { FunctionTemplate } from './create-template.types.js'
import { BEHAVIORAL_TEMPLATE_IDENTIFIER } from './b-element.constants.js'

/**
 * Type guard to identify Plaited custom elements.
 * Useful when working with DOM elements that might be Plaited components.
 *
 * @param el - Element to check
 * @returns True if element is a Plaited custom element
 *
 * @example Enhancing existing elements conditionally
 * ```tsx
 * const ComponentWrapper = bElement({
 *   tag: 'component-wrapper',
 *   shadowDom: <slot p-target="content"  p-trigger={{slotchange: 'enhanceChildren'}}/>,
 *   bProgram({ $, trigger }) {
 *     const [content] = $<HTMLSlotElement>('content');
 *
 *     return {
 *       enhanceChildren: () => {
 *         const children = content.assignedElements();
 *         children.forEach(child => {
 *           if (isBehavioralElement(child)) {
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
export const isBehavioralElement = (el: unknown): el is BehavioralElement => {
  /**
   * @internal
   * Two-part check for Behavioral elements:
   * 1. isTypeOf verifies it's an HTMLElement (not just any object)
   * 2. Object.hasOwn checks for 'trigger' property (Plaited's event method)
   * Using hasOwn instead of 'in' to check own properties only, not prototype chain.
   * This prevents false positives from prototype pollution.
   */
  return isTypeOf<BehavioralElement>(el, 'htmlelement') && Object.hasOwn(el, 'trigger')
}

/**
 * Type guard to identify Plaited template functions.
 * Used to verify that a function template was created by the Plaited framework.
 *
 * @param template - The function template to check
 * @returns True if the template is a valid Plaited template function
 *
 * @example
 * ```ts
 * import { h, Fragment } from 'plaited/jsx-runtime';
 * import { isBehavioralTemplateFunction } from 'plaited'; // Assuming direct export for example
 * import { MyComponent } from './my-component'; // A Plaited component
 *
 * const plaitedTemplate = MyComponent({ id: 'test' });
 * const regularFunction = () => ({ html: ['<div></div>'], stylesheets: [], registry: [], $: Symbol() });
 *
 * console.log(isBehavioralTemplateFunction(plaitedTemplate)); // true
 * // console.log(isBehavioralTemplateFunction(regularFunction)); // Error: Argument of type '...' is not assignable to parameter of type 'FunctionTemplate'.
 *                                                       // This demonstrates it expects a FunctionTemplate structure first.
 *
 * // A more direct example with a raw PlaitedTemplate-like object:
 * const rawPlaited = { $: BEHAVIORAL_TEMPLATE_IDENTIFIER, tag: 'div', registry: new Set(), publicEvents: [], observedAttributes: [] };
 * // console.log(isBehavioralTemplateFunction(rawPlaited)); // true if function-like, but guard expects FunctionTemplate
 *
 * // Example with a function that returns a TemplateObject but isn't a PlaitedTemplate itself
 * const simpleTemplateFunc = (props) => h('div', props);
 * // console.log(isBehavioralTemplateFunction(simpleTemplateFunc)); // true, because h returns a PlaitedTemplate
 *
 * const nonPlaitedFunc = (props) => ({ ...h('div', props), $: 'not-plaited' });
 * // console.log(isBehavioralTemplateFunction(nonPlaitedFunc)); // false
 * ```
 *
 * @remarks
 * - Checks both type structure (expects an object that could be a `FunctionTemplate` with specific properties) and the presence of Plaited's unique identifier (`BEHAVIORAL_TEMPLATE_IDENTIFIER`) on the `$` property.
 * - Primarily used internally by the Plaited framework to ensure template safety and integrity during rendering.
 * - Helps prevent the processing of invalid or potentially malicious template structures that don't originate from Plaited's factories.
 * - The type guard correctly narrows the type to `PlaitedTemplate` in TypeScript if it returns `true`.
 */
export const isBehavioralTemplate = (template: FunctionTemplate): template is BehavioralTemplate => {
  /**
   * @internal
   * Validates Plaited templates using two checks:
   * 1. isTypeOf ensures template is an object (not null/undefined/primitive)
   * 2. Checks for BEHAVIORAL_TEMPLATE_IDENTIFIER on $ property
   * The identifier is a unique symbol preventing external template spoofing.
   * This guard is critical for security in template rendering.
   */
  return isTypeOf<BehavioralTemplate>(template, 'object') && template.$ === BEHAVIORAL_TEMPLATE_IDENTIFIER
}
