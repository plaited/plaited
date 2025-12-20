/**
 * @internal
 * @module use-emit
 *
 * Type-safe custom event dispatching for cross-component communication.
 * Wraps native CustomEvent API with sensible defaults for shadow DOM.
 *
 * @remarks
 * Implementation details:
 * - Primary outbound communication mechanism for components
 * - Default composed: true is critical for shadow DOM propagation
 * - Type safety ensures event detail structure matches expectations
 * - Fire-and-forget pattern with no automatic cleanup
 * - Curried function pattern enables reuse
 *
 * Known limitations:
 * - No built-in event deduplication
 * - Cannot track if events are handled
 * - No replay or event sourcing support
 * - Limited to CustomEvent capabilities
 */

import type { BehavioralElement } from './b-element.types.ts'
import type { BPEvent } from './behavioral.types.ts'

/**
 * @internal
 * Type definition for the dispatch function that sends custom events from Behavioral elements.
 * Extends BPEvent with CustomEvent options for full control over event behavior.
 *
 * Type intersection combines:
 * - BPEvent: Provides type and detail properties
 * - CustomEvent options: Controls propagation behavior
 */
export type Emit = (
  args: BPEvent & {
    /** Whether event bubbles up through ancestors (default: false for contained events) */
    bubbles?: boolean
    /** Whether event.preventDefault() can cancel default behavior (default: true) */
    cancelable?: boolean
    /** Whether event crosses shadow DOM boundaries (default: true for component communication) */
    composed?: boolean
  },
) => boolean

export class EmitTypeError extends Error implements Error {
  override name = 'emit_type'
}

/**
 * Creates a custom event dispatcher for component communication.
 * Enables type-safe event emission across shadow DOM boundaries.
 *
 * @param element - BehavioralElement to dispatch events from
 * @returns Emit function for sending custom events
 *
 * @remarks
 * Default options:
 * - `bubbles: false` - Contained by default
 * - `cancelable: true` - Can be prevented
 * - `composed: true` - Crosses shadow DOM
 *
 * @see {@link BehavioralElement} for element context
 * @see {@link BPEvent} for event structure
 */
export const useEmit =
  (element: BehavioralElement): Emit =>
  /**
   * @internal
   * Returned dispatch function captures element reference in closure.
   * Default parameters optimized for shadow DOM component communication.
   */
  ({ type, detail, bubbles = false, cancelable = true, composed = true }) => {
    /**
     * @internal
     * Guard against missing event type to prevent runtime errors.
     * Silently returns rather than throwing for resilience.
     */
    if (!type) throw new EmitTypeError('Event type is required')

    /**
     * @internal
     * Create CustomEvent with provided options.
     * composed: true by default enables cross-shadow-boundary communication.
     * cancelable: true allows preventDefault() for event handling control.
     * bubbles: false by default prevents unintended parent notifications.
     */
    const event = new CustomEvent(type, {
      bubbles,
      cancelable,
      composed,
      detail,
    })

    /**
     * @internal
     * Dispatch event synchronously on the element.
     * Event will propagate according to bubbles/composed settings.
     */
    return element.dispatchEvent(event)
  }
