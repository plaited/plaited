import type { Trigger } from '../behavioral/b-program.js'
import type { PlaitedTrigger } from '../behavioral/get-plaited-trigger.js'
import type { PlaitedMessage, PlaitedElement } from './plaited.types'
import { isTypeOf } from '../utils/is-type-of.js'

/**
 * Type guard to identify enhanced Plaited triggers with disconnect capability.
 * Distinguishes between basic and enhanced triggers by checking for disconnect handling.
 *
 * @param trigger Trigger function to check
 * @returns True if trigger has disconnect callback support
 *
 * @example
 * ```ts
 * if (isPlaitedTrigger(trigger)) {
 *   // Can safely use addDisconnectCallback
 *   trigger.addDisconnectCallback(() => cleanup());
 * }
 * ```
 */
export const isPlaitedTrigger = (trigger: Trigger): trigger is PlaitedTrigger => 'addDisconnectCallback' in trigger
/**
 * Type guard to validate Plaited message structure.
 * Ensures messages have required address and type properties.
 *
 * @param msg Value to check
 * @returns True if value matches Plaited message structure
 *
 * @example
 * ```ts
 * const handleMessage = (msg: unknown) => {
 *   if (isPlaitedMessage(msg)) {
 *     // TypeScript knows msg has address and type
 *     console.log(msg.address, msg.type, msg.detail);
 *   }
 * };
 *
 * // Valid message
 * handleMessage({
 *   address: 'component-id',
 *   type: 'UPDATE',
 *   detail: { value: 42 }
 * });
 * ```
 */
export const isPlaitedMessage = (msg: unknown): msg is PlaitedMessage => {
  return (
    isTypeOf<{ [key: string]: unknown }>(msg, 'object') &&
    isTypeOf<string>(msg?.address, 'string') &&
    isTypeOf<string>(msg?.type, 'string')
  )
}
/**
 * Type guard to identify Plaited custom elements.
 * Checks for both HTMLElement inheritance and Plaited-specific features.
 *
 * @param el Element to check
 * @returns True if element is a Plaited custom element
 *
 * @example
 * ```ts
 * const enhanceElement = (el: Element) => {
 *   if (isPlaitedElement(el)) {
 *     // Can safely use Plaited features
 *     el.trigger({
 *       type: 'INIT',
 *       detail: { initialized: true }
 *     });
 *   }
 * };
 * ```
 *
 * @remarks
 * - Verifies element is HTMLElement
 * - Checks for required Plaited features
 * - Provides type narrowing for TypeScript
 */
export const isPlaitedElement = (el: unknown): el is PlaitedElement =>
  isTypeOf<PlaitedElement>(el, 'htmlelement') && 'trigger' in el
