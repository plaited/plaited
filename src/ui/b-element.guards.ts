/**
 * @internal
 * @module plaited.guards
 *
 * Runtime type guards for safe identification of Plaited templates and elements.
 * Type predicate functions using structural checking and unique identifiers.
 *
 * @remarks
 * Implementation details:
 * - isBehavioralElement checks for trigger method (unique to Behavioral elements)
 * - isBehavioralTemplate uses unique identifier to prevent spoofing
 * - Guards narrow TypeScript types for better type inference
 * - Critical for safe interop between Plaited and regular DOM elements
 *
 * Performance: Object.hasOwn is faster than 'in' operator.
 *
 * Known limitations:
 * - Cannot detect Behavioral elements before upgrade
 * - Relies on structural typing (duck typing)
 * - No versioning support for element API changes
 * - Spoofable by adding trigger method to regular elements
 */

import { isTypeOf } from '../utils.ts'
import { BEHAVIORAL_TEMPLATE_IDENTIFIER } from './b-element.constants.ts'
import type { BehavioralElement, BehavioralTemplate } from './b-element.types.ts'
import type { FunctionTemplate } from './create-template.types.ts'

/**
 * Type guard to identify Plaited custom elements.
 * Useful when working with DOM elements that might be BehavioralElements.
 *
 * @param el - Element to check
 * @returns True if element is a Plaited custom element
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
  return isTypeOf<BehavioralTemplate>(template, 'function') && template.$ === BEHAVIORAL_TEMPLATE_IDENTIFIER
}
